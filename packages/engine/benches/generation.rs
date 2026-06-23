//! Criterion benchmarks for the schedule-generation engine.
//!
//! These run against the real committed `.pb` datasets (built by
//! `pnpm build:data-proto`). When the artifacts are absent the benches print a
//! notice and register nothing, so `cargo bench` still succeeds in a clean
//! checkout. Run with `cargo bench` (or `pnpm --filter @uoplan/engine bench`).

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use prost::Message;
use uoplan_engine::proto::data::SchedulesData;
use uoplan_engine::proto::engine::{
    BlockedTime, GenerationConstraints, GenerationRequest, RemainingRequirement, TimetableRequest,
};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/catalogue.2026.pb"
);
const SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/schedules.2269.pb"
);

/// Loaded real dataset plus a deterministic list of schedulable course codes.
struct Dataset {
    engine: Engine,
    /// Course codes that have at least one component (i.e. are schedulable).
    schedulable: Vec<String>,
}

/// Loads the committed catalogue + schedules `.pb` files. Returns `None` when the
/// build artifacts haven't been generated yet (so benches can be skipped cleanly).
fn load_dataset() -> Option<Dataset> {
    let cat_bytes = std::fs::read(CATALOGUE_PB).ok()?;
    let sched_bytes = std::fs::read(SCHEDULES_PB).ok()?;

    let sched = SchedulesData::decode(sched_bytes.as_slice()).ok()?;

    // Collect schedulable course codes in deterministic order.
    let mut schedulable: Vec<String> = Vec::new();
    for s in &sched.schedules {
        if s.components.is_empty() {
            continue;
        }
        if let Some(code) = sched.course_codes.get(s.course as usize) {
            schedulable.push(code.clone());
        }
    }
    schedulable.sort();
    schedulable.dedup();

    let engine = Engine::new(&cat_bytes, &sched_bytes).ok()?;
    Some(Dataset {
        engine,
        schedulable,
    })
}

/// Undergrad (level 1000-4000) subset of the schedulable codes, mirroring the
/// `undergrad_schedulable` helper in `tests/selection_feasibility.rs` so the
/// advanced benches exercise the same realistic full-pool selection.
fn undergrad_pool(schedulable: &[String]) -> Vec<String> {
    let mut out: Vec<String> = schedulable
        .iter()
        .filter(|code| {
            let first_digit = code
                .chars()
                .skip_while(|c| c.is_alphabetic())
                .find(|c| c.is_ascii_digit())
                .and_then(|c| c.to_digit(10));
            matches!(first_digit, Some(1..=4))
        })
        .cloned()
        .collect();
    out.sort();
    out.dedup();
    out
}

/// Advanced-mode full-pool generation request: select `target` courses (3 credits
/// each) from a single "core" requirement spanning the whole `pool`.
fn advanced_request(pool: &[String], target: u32, seed: u32) -> Vec<u8> {
    GenerationRequest {
        courses_this_semester: target,
        include_closed_components: true,
        level_buckets: vec!["undergrad".to_string(), "grad".to_string()],
        language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
        prereq_eligible_courses: pool.to_vec(),
        remaining_requirements: vec![RemainingRequirement {
            requirement_id: "core".to_string(),
            r#type: "core".to_string(),
            title: Some("Core".to_string()),
            candidate_courses: pool.to_vec(),
            credits_needed: Some(f64::from(target) * 3.0),
            picked_count: None,
            satisfied_by: vec![],
        }],
        current_seed: seed,
        first_seed: seed,
        ..Default::default()
    }
    .encode_to_vec()
}

/// A named hard-constraint configuration applied to a timetable request.
struct Config {
    name: &'static str,
    constraints: GenerationConstraints,
    virtual_sections_only: bool,
}

fn configs() -> Vec<Config> {
    let blocked_mornings: Vec<BlockedTime> = (0u32..5)
        .map(|day| BlockedTime {
            day,
            start_minutes: 0,
            end_minutes: 600,
        })
        .collect();
    vec![
        Config {
            name: "default",
            constraints: GenerationConstraints {
                max_end_minutes: 24 * 60,
                ..Default::default()
            },
            virtual_sections_only: false,
        },
        Config {
            name: "window_9_17",
            constraints: GenerationConstraints {
                min_start_minutes: 540,
                max_end_minutes: 1020,
                ..Default::default()
            },
            virtual_sections_only: false,
        },
        Config {
            name: "blocked_mornings",
            constraints: GenerationConstraints {
                max_end_minutes: 24 * 60,
                blocked_times: blocked_mornings,
                ..Default::default()
            },
            virtual_sections_only: false,
        },
        Config {
            name: "virtual_only",
            constraints: GenerationConstraints {
                max_end_minutes: 24 * 60,
                ..Default::default()
            },
            virtual_sections_only: true,
        },
    ]
}

fn timetable_request(codes: &[String], cfg: &Config, seed: u32) -> Vec<u8> {
    TimetableRequest {
        course_codes: codes.to_vec(),
        constraints: Some(cfg.constraints.clone()),
        seed,
        include_closed_components: true,
        virtual_sections_only: cfg.virtual_sections_only,
        ..Default::default()
    }
    .encode_to_vec()
}

/// Bench: constructing the engine (decode datasets + build the data view).
fn bench_engine_new(c: &mut Criterion) {
    let (Ok(cat_bytes), Ok(sched_bytes)) =
        (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB))
    else {
        eprintln!(
            "skipping engine_new bench: .pb artifacts not built (run `pnpm build:data-proto`)"
        );
        return;
    };

    c.bench_function("engine_new", |b| {
        b.iter(|| {
            let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();
            std::hint::black_box(engine.course_count());
        });
    });
}

/// Bench: timetabling a FIXED set of N real courses (the UI swap path), swept
/// over course counts to show how cost scales with the number of courses.
fn bench_timetable_amounts(c: &mut Criterion) {
    let Some(ds) = load_dataset() else {
        eprintln!(
            "skipping timetable benches: .pb artifacts not built (run `pnpm build:data-proto`)"
        );
        return;
    };

    let mut group = c.benchmark_group("timetable_fixed_set/amount");
    group.sample_size(30);
    let default_cfg = &configs()[0];
    for &n in &[5usize, 10, 15, 20, 24] {
        if ds.schedulable.len() < n {
            continue;
        }
        let codes: Vec<String> = ds.schedulable.iter().take(n).cloned().collect();
        let request = timetable_request(&codes, default_cfg, 12_345);
        group.throughput(Throughput::Elements(n as u64));
        group.bench_with_input(BenchmarkId::from_parameter(n), &request, |b, req| {
            b.iter(|| std::hint::black_box(ds.engine.timetable_fixed_set(req).unwrap()));
        });
    }
    group.finish();
}

/// Bench: timetabling a fixed 12-course set under each hard-constraint config, to
/// show the relative cost of time windows, blocked times, and virtual-only
/// filtering.
fn bench_timetable_configs(c: &mut Criterion) {
    const N: usize = 12;
    let Some(ds) = load_dataset() else {
        return;
    };
    if ds.schedulable.len() < N {
        return;
    }
    let codes: Vec<String> = ds.schedulable.iter().take(N).cloned().collect();

    let mut group = c.benchmark_group("timetable_fixed_set/config");
    group.sample_size(30);
    for cfg in configs() {
        let request = timetable_request(&codes, &cfg, 12_345);
        group.bench_with_input(BenchmarkId::from_parameter(cfg.name), &request, |b, req| {
            b.iter(|| std::hint::black_box(ds.engine.timetable_fixed_set(req).unwrap()));
        });
    }
    group.finish();
}

/// Bench: full basic-mode generation pinning N real courses (forces the engine to
/// pick + timetable them), swept over course counts.
fn bench_basic_pinned(c: &mut Criterion) {
    let Some(ds) = load_dataset() else {
        return;
    };

    let mut group = c.benchmark_group("basic_generate/pinned");
    group.sample_size(30);
    for &n in &[5usize, 10, 20] {
        if ds.schedulable.len() < n {
            continue;
        }
        let pinned: Vec<String> = ds.schedulable.iter().take(n).cloned().collect();
        let request = GenerationRequest {
            basic_pinned_courses: pinned,
            basic_electives_count: 0,
            include_closed_components: true,
            current_seed: 12_345,
            first_seed: 12_345,
            ..Default::default()
        }
        .encode_to_vec();
        group.throughput(Throughput::Elements(n as u64));
        group.bench_with_input(BenchmarkId::from_parameter(n), &request, |b, req| {
            b.iter(|| std::hint::black_box(ds.engine.generate(req).unwrap()));
        });
    }
    group.finish();
}

/// Bench: full basic-mode generation selecting N elective courses from the whole
/// catalogue (exercises candidate-pool building, weighted random selection, and
/// subset timetabling), swept over the elective count.
fn bench_basic_electives(c: &mut Criterion) {
    let Some(ds) = load_dataset() else {
        return;
    };

    let mut group = c.benchmark_group("basic_generate/electives");
    group.sample_size(30);
    for &n in &[1u32, 3, 5, 10] {
        let request = GenerationRequest {
            basic_electives_count: n,
            level_buckets: vec!["undergrad".to_string()],
            language_buckets: vec!["en".to_string(), "other".to_string()],
            elective_level_buckets: vec![1000, 2000, 3000, 4000],
            include_closed_components: true,
            current_seed: 12_345,
            first_seed: 12_345,
            ..Default::default()
        }
        .encode_to_vec();
        group.throughput(Throughput::Elements(u64::from(n)));
        group.bench_with_input(BenchmarkId::from_parameter(n), &request, |b, req| {
            b.iter(|| std::hint::black_box(ds.engine.generate(req).unwrap()));
        });
    }
    group.finish();
}

/// Bench: advanced-mode full-pool selection over the realistic undergrad pool,
/// swept over near-capacity targets. This is the path that regressed on slow CI
/// (`selection_feasibility::advanced_full_pool_every_seed_succeeds_quickly`);
/// seeds are the ones CI flagged as worst-case so the bench tracks the tail, not
/// the average.
fn bench_advanced_full_pool(c: &mut Criterion) {
    let Some(ds) = load_dataset() else {
        eprintln!(
            "skipping advanced benches: .pb artifacts not built (run `pnpm build:data-proto`)"
        );
        return;
    };
    let pool = undergrad_pool(&ds.schedulable);
    if pool.len() < 1000 {
        return;
    }

    let mut group = c.benchmark_group("advanced_generate/full_pool");
    group.sample_size(10);
    // (target, heavy seed). Seed 60 at target 24 is the CI worst-case repro.
    for &(target, seed) in &[(22u32, 7u32), (24u32, 60u32)] {
        let request = advanced_request(&pool, target, seed);
        group.throughput(Throughput::Elements(u64::from(target)));
        group.bench_with_input(BenchmarkId::from_parameter(target), &request, |b, req| {
            b.iter(|| std::hint::black_box(ds.engine.generate(req).unwrap()))
        });
    }
    group.finish();
}

/// Bench: advanced-mode infeasible request (40 conflict-free courses can't fit in
/// one week). This is the fast-fail path that regressed on slow CI
/// (`selection_feasibility::advanced_infeasible_request_fails_fast_for_every_seed`);
/// it must exhaust the work budget and bail quickly. Seed 1 is the CI worst-case.
fn bench_advanced_infeasible(c: &mut Criterion) {
    let Some(ds) = load_dataset() else {
        return;
    };
    let pool = undergrad_pool(&ds.schedulable);
    if pool.len() < 1000 {
        return;
    }

    let mut group = c.benchmark_group("advanced_generate/infeasible");
    group.sample_size(10);
    let request = advanced_request(&pool, 40, 1);
    group.bench_with_input(BenchmarkId::from_parameter(40), &request, |b, req| {
        b.iter(|| std::hint::black_box(ds.engine.generate(req).unwrap()));
    });
    group.finish();
}

criterion_group!(
    benches,
    bench_engine_new,
    bench_timetable_amounts,
    bench_timetable_configs,
    bench_basic_pinned,
    bench_basic_electives,
    bench_advanced_full_pool,
    bench_advanced_infeasible,
);
criterion_main!(benches);
