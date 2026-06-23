//! Regression guard for the best-of-K timeout.
//!
//! `fixtures/good_breaks_request.pb` is a real captured `GenerationRequest` with
//! a shape objective active (good breaks), which selects `candidate_count =
//! BEST_OF_K`. The expensive eligibility scan that builds the per-requirement
//! candidate lists is **seed-independent**, so it must run ONCE for the whole
//! best-of-K sweep — not once per attempt. Before the scan-once fix this request
//! took ~8.7s (32 × the single-pass cost) and blew the schedule worker's
//! wall-clock kill, surfacing to users as "failed to generate".
//!
//! The test loads the committed year catalogue + schedules assets and skips
//! gracefully if they are absent (mirrors `selection_feasibility.rs`).

use prost::Message;
use uoplan_engine::proto::engine::{GenerationRequest, GenerationResponse};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/catalogue.2026.pb"
);
const SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/schedules.2269.pb"
);
const REQUEST_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/good_breaks_request.pb"
);

#[test]
fn good_breaks_request_generates_under_budget() {
    let (Ok(cat_bytes), Ok(sched_bytes), Ok(req_bytes)) = (
        std::fs::read(CATALOGUE_PB),
        std::fs::read(SCHEDULES_PB),
        std::fs::read(REQUEST_PB),
    ) else {
        eprintln!("skip good_breaks_request_generates_under_budget: data artifacts missing");
        return;
    };
    let engine = Engine::new(&cat_bytes, &sched_bytes).expect("engine builds from assets");
    let request = GenerationRequest::decode(req_bytes.as_slice()).expect("request decodes");

    let started = std::time::Instant::now();
    let resp = GenerationResponse::decode(
        engine
            .generate(&request.encode_to_vec())
            .expect("generate succeeds")
            .as_slice(),
    )
    .expect("response decodes");
    let elapsed = started.elapsed();

    assert!(
        resp.has_schedule,
        "expected a schedule for the captured good-breaks request"
    );
    assert!(
        elapsed.as_secs_f64() < 2.0,
        "good_breaks generation took {elapsed:?}; must be < 2s — best-of-K must not rebuild the \
         seed-independent eligibility scan on every attempt"
    );
}
