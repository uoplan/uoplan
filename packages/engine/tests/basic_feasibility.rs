//! Regression for seed-dependent *basic-mode* failures — the user's actual repro:
//! two share links differing by a single seed character (consecutive seeds), one
//! generating a full 23-course schedule instantly and the other timing out.
//!
//! Root cause history: basic generation filled the elective slots with an
//! exhaustive chronological-backtracking DFS over the optional pool
//! (`first_seeded_subset_arrangement`). Its forward check scanned the whole
//! remaining pool at every node, and its node budget bounded node *count*, not
//! work, so on a permissive pool a single run did billions of overlap checks —
//! tens of seconds to minutes — and on most seeds exhausted the node budget and
//! returned `has_schedule = false` even though a 23-course schedule existed
//! (a false negative). Whether a seed happened to stumble onto a fitting set
//! before the budget ran out was pure luck → the reported non-determinism.
//!
//! Basic fill is now a randomized-restart greedy with a *work-charged* global
//! budget (mirroring `advanced.rs`): each restart reshuffles the optional order
//! and greedily packs electives that fit, charging the budget by actual overlap
//! work. Two properties must hold across many seeds:
//!   1. Determinism: every seed yields a full schedule (the seed only changes
//!      *which* valid schedule, never *whether* one is found).
//!   2. Bounded latency: each seed completes far below the worker's 3 s
//!      wall-clock kill — including the ~1.5-2x WASM slowdown over this native
//!      release test — so success never depends on the wall clock.
//!
//! Runs against the committed term-2271 `.pb` datasets (the user's term); skipped
//! (and green) when the artifacts are absent.

use std::time::{Duration, Instant};

use prost::Message;
use uoplan_engine::proto::engine::{GenerationRequest, GenerationResponse, Mode};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/../../apps/web/src/assets/data/catalogue.2026.pb");
const SCHEDULES_PB: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/../../apps/web/src/assets/data/schedules.2271.pb");

const SEEDS: u32 = 64;

/// Native per-seed wall-clock ceiling. The worker kill is 3000 ms and the WASM
/// build runs ~1.5-2x slower than this native release test, so a sub-2 s native
/// ceiling keeps margin in the browser. This is a coarse safety net, not the real
/// bound — total engine work is hard-capped internally by the work-charged global
/// budget, independent of wall clock.
const PER_SEED_BUDGET: Duration = Duration::from_millis(2_000);

/// True when the test binary runs under coverage instrumentation
/// (`cargo llvm-cov`), which heavily skews wall-clock timing. The coarse
/// per-seed wall-clock net is meaningless there, so it is relaxed while the
/// correctness assertions (feasibility, course counts) still run. The real
/// bound is the internal work-charged budget, independent of wall clock.
fn coverage_instrumented() -> bool {
    std::env::var_os("LLVM_PROFILE_FILE").is_some()
}

/// Default basic-mode filters (undergrad, English + other, 1000/2000 level), with
/// no completed courses and no pinned courses — the exact shape of the reported
/// repro (term 2271, 23 electives, default options, no transcript).
fn default_basic_request(electives: u32) -> GenerationRequest {
    GenerationRequest {
        mode: Mode::Basic as i32,
        basic_electives_count: electives,
        include_closed_components: false,
        level_buckets: vec!["undergrad".to_string()],
        language_buckets: vec!["en".to_string(), "other".to_string()],
        elective_level_buckets: vec![1000, 2000],
        ..Default::default()
    }
}

fn load_engine() -> Option<Engine> {
    let (Ok(cat), Ok(sched)) = (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB)) else {
        return None;
    };
    Some(Engine::new(&cat, &sched).unwrap())
}

#[test]
fn basic_full_electives_every_seed_succeeds_quickly() {
    let Some(engine) = load_engine() else {
        eprintln!("skipping basic_full_electives_every_seed_succeeds_quickly: .pb not built");
        return;
    };

    // 23 electives from the default-filter pool is feasible (some seeds packed it
    // even under the old solver); every seed must now find a full 23-course
    // schedule within budget.
    let electives = 23u32;
    let base = default_basic_request(electives);

    let mut worst = Duration::ZERO;
    for seed in 1..=SEEDS {
        let mut req = base.clone();
        req.current_seed = seed;
        req.first_seed = seed;

        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            resp.has_schedule,
            "seed {seed}: no schedule, though the pool packs {electives} conflict-free \
             electives for other seeds (seed must not decide feasibility)"
        );
        assert_eq!(
            resp.courses.len(),
            electives as usize,
            "seed {seed}: expected {electives} courses, got {}",
            resp.courses.len()
        );
        assert!(
            coverage_instrumented() || elapsed <= PER_SEED_BUDGET,
            "seed {seed}: took {elapsed:?} (> {PER_SEED_BUDGET:?}); a slow seed risks the \
             worker timeout once run as WASM"
        );
    }
    eprintln!("basic {electives} electives: {SEEDS} seeds OK, worst {worst:?}");
}

/// The two exact share-link seeds from the bug report (consecutive seeds, one of
/// which used to time out). Both must now succeed quickly.
#[test]
fn basic_reported_repro_seeds_both_succeed() {
    let Some(engine) = load_engine() else {
        eprintln!("skipping basic_reported_repro_seeds_both_succeed: .pb not built");
        return;
    };
    let base = default_basic_request(23);
    for seed in [1_324_429_232u32, 1_324_429_233] {
        let mut req = base.clone();
        req.current_seed = seed;
        req.first_seed = seed;

        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(resp.has_schedule, "reported seed {seed}: no schedule");
        assert_eq!(resp.courses.len(), 23, "reported seed {seed}: not 23 courses");
        assert!(
            coverage_instrumented() || elapsed <= PER_SEED_BUDGET,
            "reported seed {seed}: took {elapsed:?} (> {PER_SEED_BUDGET:?})"
        );
    }
}

/// An over-capacity basic request can never be satisfied: a week has a finite
/// number of non-overlapping teaching slots, so no pool packs 40 conflict-free
/// courses. The old DFS ground on such inputs until the worker's wall-clock kill;
/// the work-charged budget now bounds total work, so an infeasible request must
/// return `has_schedule = false` quickly and deterministically for every seed.
#[test]
fn basic_infeasible_request_fails_fast_for_every_seed() {
    let Some(engine) = load_engine() else {
        eprintln!("skipping basic_infeasible_request_fails_fast_for_every_seed: .pb not built");
        return;
    };
    let base = default_basic_request(40);

    let mut worst = Duration::ZERO;
    for seed in 1..=SEEDS {
        let mut req = base.clone();
        req.current_seed = seed;
        req.first_seed = seed;

        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            !resp.has_schedule,
            "seed {seed}: reported a schedule for an impossible 40-course basic request"
        );
        assert!(
            coverage_instrumented() || elapsed <= PER_SEED_BUDGET,
            "seed {seed}: infeasible request took {elapsed:?} (> {PER_SEED_BUDGET:?}); the \
             internal work bound must stop it well under the worker timeout, not grind to it"
        );
    }
    eprintln!("basic infeasible 40: {SEEDS} seeds all fast-failed, worst {worst:?}");
}
