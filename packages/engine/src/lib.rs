use prost::Message;
use std::collections::{BTreeMap, HashMap};
use wasm_bindgen::prelude::*;

/// Generated protobuf types (prost). File names follow the proto `package`.
pub mod proto {
    pub mod engine {
        include!(concat!(env!("OUT_DIR"), "/engine.rs"));
    }
    pub mod data {
        include!(concat!(env!("OUT_DIR"), "/scheduledata.rs"));
    }
    pub mod state {
        include!(concat!(env!("OUT_DIR"), "/schedule.rs"));
    }
}

mod advanced;
mod constraints;
mod electives;
mod ffi;
#[cfg(target_os = "android")]
mod jni_android;
mod model;
mod objectives;
mod pools;
mod prereq;
mod rng;
mod timetable;
mod types;
mod weights;

use constraints::Constraints;
use model::{DataView, LanguageBucket, LevelBucket};
use objectives::Objectives;
use proto::engine::{
    ChosenCourse, ComponentChoice, EmptyPool, GenerationRequest, GenerationResponse,
    PoolDiagnostics,
};
use types::Enrollment;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Error type for the platform-agnostic engine core. Wraps a human-readable
/// message; binding layers map this to their platform's error type (`JsError`
/// for the WASM [`Engine`], a UniFFI/C-ABI error for the native iOS/Android
/// binding).
#[derive(Debug, Clone)]
pub struct EngineError(pub String);

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for EngineError {}

/// The platform-agnostic schedule-generation engine. Contains **no**
/// binding-specific types (no `wasm_bindgen`, no `JsError`), so it can be wrapped
/// by the WASM glue ([`Engine`]) for the web app + OG-image worker, and by a
/// native FFI binding (UniFFI / C-ABI via `cargo-ndk`) for the iOS/Android apps.
///
/// Decode the catalogue + schedule datasets once, then call
/// [`EngineCore::generate`] with a serialized [`GenerationRequest`]. The whole
/// surface is bytes-in/bytes-out (protobuf), which keeps every FFI boundary
/// trivial.
pub struct EngineCore {
    data: DataView,
}

impl EngineCore {
    /// Construct from the `catalogue.pb` and schedules `.pb` bytes.
    pub fn new(catalogue: &[u8], schedules: &[u8]) -> Result<EngineCore, EngineError> {
        let catalogue = proto::data::Catalogue::decode(catalogue)
            .map_err(|e| EngineError(format!("failed to decode catalogue: {e}")))?;
        let schedules = proto::data::SchedulesData::decode(schedules)
            .map_err(|e| EngineError(format!("failed to decode schedules: {e}")))?;
        Ok(EngineCore {
            data: DataView::new(catalogue, schedules),
        })
    }

    /// Generate a schedule for the given serialized [`GenerationRequest`],
    /// returning a serialized [`GenerationResponse`].
    pub fn generate(&self, request: &[u8]) -> Result<Vec<u8>, EngineError> {
        let request = GenerationRequest::decode(request)
            .map_err(|e| EngineError(format!("failed to decode request: {e}")))?;
        let response = run_generation(&self.data, request);
        Ok(response.encode_to_vec())
    }

    /// Re-timetable a FIXED set of courses (the UI swap feature). Decodes a
    /// serialized [`TimetableRequest`] and returns a serialized
    /// [`GenerationResponse`] (`has_schedule` + the chosen section per course).
    pub fn timetable_fixed_set(&self, request: &[u8]) -> Result<Vec<u8>, EngineError> {
        let req = proto::engine::TimetableRequest::decode(request)
            .map_err(|e| EngineError(format!("failed to decode timetable request: {e}")))?;
        let response = run_timetable_fixed_set(&self.data, req);
        Ok(response.encode_to_vec())
    }

    /// Number of courses in the loaded catalogue (smoke-test accessor).
    pub fn course_count(&self) -> usize {
        self.data.course_count()
    }

    /// Number of course schedules loaded (smoke-test accessor).
    pub fn schedule_count(&self) -> usize {
        self.data.schedule_count()
    }
}

/// WASM binding over [`EngineCore`]. A thin wrapper that maps [`EngineError`] to
/// `JsError`; **all** generation logic lives in the platform-agnostic core so the
/// native binding can share it verbatim.
#[wasm_bindgen]
pub struct Engine {
    core: EngineCore,
}

#[wasm_bindgen]
impl Engine {
    /// Construct an engine from the `catalogue.pb` and schedules `.pb` bytes.
    #[wasm_bindgen(constructor)]
    pub fn new(catalogue: &[u8], schedules: &[u8]) -> Result<Engine, JsError> {
        EngineCore::new(catalogue, schedules)
            .map(|core| Engine { core })
            .map_err(|e| JsError::new(&e.0))
    }

    /// Generate a schedule for the given serialized [`GenerationRequest`],
    /// returning a serialized [`GenerationResponse`].
    #[wasm_bindgen]
    pub fn generate(&self, request: &[u8]) -> Result<Vec<u8>, JsError> {
        self.core.generate(request).map_err(|e| JsError::new(&e.0))
    }

    /// Number of courses in the loaded catalogue (smoke-test accessor).
    #[wasm_bindgen(getter)]
    pub fn course_count(&self) -> usize {
        self.core.course_count()
    }

    /// Number of course schedules loaded (smoke-test accessor).
    #[wasm_bindgen(getter)]
    pub fn schedule_count(&self) -> usize {
        self.core.schedule_count()
    }

    /// Re-timetable a FIXED set of courses (the UI swap feature). Decodes a
    /// serialized [`TimetableRequest`] and returns a serialized
    /// [`GenerationResponse`] (`has_schedule` + the chosen section per course).
    #[wasm_bindgen]
    pub fn timetable_fixed_set(&self, request: &[u8]) -> Result<Vec<u8>, JsError> {
        self.core
            .timetable_fixed_set(request)
            .map_err(|e| JsError::new(&e.0))
    }
}

fn level_buckets_from(strings: &[String]) -> Vec<LevelBucket> {
    strings
        .iter()
        .filter_map(|s| match s.as_str() {
            "undergrad" => Some(LevelBucket::Undergrad),
            "grad" => Some(LevelBucket::Grad),
            _ => None,
        })
        .collect()
}

fn language_buckets_from(strings: &[String]) -> Vec<LanguageBucket> {
    strings
        .iter()
        .filter_map(|s| match s.as_str() {
            "en" => Some(LanguageBucket::En),
            "fr" => Some(LanguageBucket::Fr),
            "other" => Some(LanguageBucket::Other),
            _ => None,
        })
        .collect()
}

fn build_constraints(req: &GenerationRequest, prefer_professor_rating: bool) -> Constraints {
    constraints_from(
        req.constraints.as_ref(),
        &req.professor_ratings,
        prefer_professor_rating,
    )
}

fn constraints_from(
    gc: Option<&proto::engine::GenerationConstraints>,
    professor_ratings: &HashMap<String, f64>,
    prefer_professor_rating: bool,
) -> Constraints {
    let mut c = Constraints {
        professor_ratings: professor_ratings.clone(),
        prefer_professor_rating,
        ..Default::default()
    };
    if let Some(gc) = gc {
        c.min_start = gc.min_start_minutes;
        c.max_end = if gc.max_end_minutes == 0 {
            24 * 60
        } else {
            gc.max_end_minutes
        };
        c.max_first_year_credits = gc.max_first_year_credits;
        c.blocked = gc
            .blocked_times
            .iter()
            .map(|b| (b.day.min(6) as u8, b.start_minutes, b.end_minutes))
            .collect();
    } else {
        c.max_end = 24 * 60;
    }
    c
}

fn run_timetable_fixed_set(
    data: &DataView,
    req: proto::engine::TimetableRequest,
) -> GenerationResponse {
    // Timetabling a fixed set: only the timetable-shape + professor objectives
    // apply (course selection is fixed), so the A+/sentiment maps are empty.
    let empty_aplus: HashMap<String, f64> = HashMap::new();
    let empty_sentiment: HashMap<String, f64> = HashMap::new();
    let objectives = Objectives::from_request(
        &req.optimization_priorities,
        &req.professor_ratings,
        &empty_aplus,
        &empty_sentiment,
    );
    let constraints = constraints_from(
        req.constraints.as_ref(),
        &req.professor_ratings,
        objectives.prefer_professor_rating(),
    );

    // Apply the blacklist as a hard course-scope check (parity with
    // `buildTimetablePipeline({ applyBlacklist })`): a fixed set containing a
    // blacklisted course cannot be timetabled.
    if req.apply_blacklist && !req.blacklisted_courses.is_empty() {
        let blocked: std::collections::HashSet<String> = req
            .blacklisted_courses
            .iter()
            .map(|c| model::normalize_course_code(c))
            .collect();
        if req
            .course_codes
            .iter()
            .any(|c| blocked.contains(&model::normalize_course_code(c)))
        {
            return GenerationResponse {
                has_schedule: false,
                error: Some("blacklisted".to_string()),
                ..Default::default()
            };
        }
    }

    let exempt: std::collections::HashSet<String> = req
        .virtual_exempt_courses
        .iter()
        .map(|c| model::normalize_course_code(c))
        .collect();
    let virtual_only = req.virtual_sections_only;
    let resolver = timetable::FnResolver {
        data,
        include_closed: req.include_closed_components,
        virtual_for: |code: &str| {
            virtual_only && !exempt.contains(&model::normalize_course_code(code))
        },
    };

    // Objective-aware timetabling. The course set is fixed, so rather than
    // sampling K feasibility-first arrangements and ranking them, search the
    // arrangement space directly for the one the priority comparator prefers —
    // this makes the #1 priority a guarantee whenever the set admits it (e.g. a
    // swap that keeps "1 good break"). With no timetable-shape objective active
    // the comparator is irrelevant, so keep the cheap first-feasible arrangement
    // (byte-for-byte unchanged behaviour).
    let mut rng = rng::Rng::new(rng::scramble_seed(req.seed) ^ 0x9e37_79b9);
    let schedule = if objectives.needs_best_of_k() {
        timetable::best_seeded_arrangement(
            &req.course_codes,
            data,
            &resolver,
            &constraints,
            &mut rng,
            &|chosen| objectives.score(chosen),
            &|a, b| objectives.better(a, b),
        )
    } else {
        timetable::first_seeded_arrangement(
            &req.course_codes,
            data,
            &resolver,
            &constraints,
            &mut rng,
        )
    };
    let has_schedule = schedule.is_some();
    GenerationResponse {
        has_schedule,
        courses: schedule
            .as_ref()
            .map(|s| s.iter().map(enrollment_to_chosen).collect())
            .unwrap_or_default(),
        optional_pool: Vec::new(),
        pinned: Vec::new(),
        chosen_course_to_requirement: HashMap::new(),
        pool_diagnostics: None,
        error: if has_schedule {
            None
        } else {
            Some("no_schedule".to_string())
        },
    }
}

fn string_list_map(
    m: &HashMap<String, proto::engine::StringList>,
) -> BTreeMap<String, Vec<String>> {
    m.iter()
        .map(|(k, v)| (k.clone(), v.values.clone()))
        .collect()
}

fn enrollment_to_chosen(e: &Enrollment) -> ChosenCourse {
    ChosenCourse {
        course_code: e.course_code.clone(),
        components: e
            .sections
            .iter()
            .map(|(component, section)| ComponentChoice {
                component: component.clone(),
                section: section.clone(),
            })
            .collect(),
    }
}

fn generation_response(
    schedule: Option<Vec<Enrollment>>,
    optional_pool: Vec<String>,
    pinned: Vec<String>,
    chosen_course_to_requirement: HashMap<String, String>,
    pool_diagnostics: Option<advanced::PoolDiagnostics>,
    error: Option<String>,
) -> GenerationResponse {
    let has_schedule = schedule.is_some();
    GenerationResponse {
        has_schedule,
        courses: schedule
            .as_ref()
            .map(|s| s.iter().map(enrollment_to_chosen).collect())
            .unwrap_or_default(),
        optional_pool,
        pinned,
        chosen_course_to_requirement,
        pool_diagnostics: pool_diagnostics.map(|d| PoolDiagnostics {
            empty_pools: d
                .empty_pools
                .into_iter()
                .map(|p| EmptyPool {
                    label: p.label,
                    requirement_id: Some(p.requirement_id),
                    candidate_courses: p.candidate_courses,
                })
                .collect(),
            total_available: d.total_available as u32,
            total_needed: d.total_needed as u32,
        }),
        error: if has_schedule { None } else { error },
    }
}

fn run_generation(data: &DataView, req: GenerationRequest) -> GenerationResponse {
    let objectives = Objectives::from_request(
        &req.optimization_priorities,
        &req.professor_ratings,
        &req.course_aplus,
        &req.course_sentiment,
    );
    let constraints = build_constraints(&req, objectives.prefer_professor_rating());
    let course_aplus = &req.course_aplus;
    let course_sentiment = &req.course_sentiment;

    let effective_base = if req.current_seed != 0 {
        req.current_seed
    } else {
        req.first_seed
    };

    // Unified basket synthesis. A pure-basket request (pinned courses + "fill N
    // electives", no degree program) is modelled as the advanced requirement-pool
    // path: pinned courses become forced courses, and the N electives become a
    // single synthesized `free_elective` pool whose candidates are the filtered
    // catalogue scan (the old basic-mode candidate logic, now in `electives`).
    // This removes the separate basic generation branch — there is one code path.
    let level_buckets = level_buckets_from(&req.level_buckets);
    let language_buckets = language_buckets_from(&req.language_buckets);
    let basket_mode = !req.basic_pinned_courses.is_empty() || req.additional_electives_count > 0;

    let mut forced_courses = req.forced_courses.clone();
    let mut remaining_requirements: Vec<pools::RemainingRequirement> = req
        .remaining_requirements
        .iter()
        .map(|r| pools::RemainingRequirement {
            requirement_id: r.requirement_id.clone(),
            req_type: r.r#type.clone(),
            title: r.title.clone(),
            candidate_courses: r.candidate_courses.clone(),
            credits_needed: r.credits_needed.unwrap_or(0.0),
        })
        .collect();
    let mut prereq_eligible_courses = req.prereq_eligible_courses.clone();
    let courses_this_semester = req.courses_this_semester as usize;

    if basket_mode {
        for code in &req.basic_pinned_courses {
            if !forced_courses.iter().any(|c| c == code) {
                forced_courses.push(code.clone());
            }
        }
        // `courses_this_semester` (N) is the cart cap + requirement-overflow
        // target; the M additional electives below are reserved on a separate
        // budget and are NOT folded in. N is always set explicitly by callers
        // (default 5) and is honoured verbatim — N < cart caps the cart in
        // `advanced.rs`, and N == 0 schedules no cart courses.
        if req.additional_electives_count > 0 {
            let pool = electives::expand_elective_pool(&electives::ElectivePoolParams {
                data,
                constraints: &constraints,
                pinned: &req.basic_pinned_courses,
                completed_courses: &req.completed_courses,
                student_programs: &req.student_programs,
                level_buckets: &level_buckets,
                language_buckets: &language_buckets,
                elective_level_buckets: &req.elective_level_buckets,
                excluded_categories: &req.basic_excluded_categories,
                blacklisted_courses: &req.blacklisted_courses,
                include_closed: req.include_closed_components,
                virtual_sections_only: req.virtual_sections_only,
            });
            for code in &pool {
                if !prereq_eligible_courses.iter().any(|c| c == code) {
                    prereq_eligible_courses.push(code.clone());
                }
            }
            remaining_requirements.push(pools::RemainingRequirement {
                requirement_id: pools::ADDITIONAL_ELECTIVES_ID.to_string(),
                req_type: "free_elective".to_string(),
                title: Some("Electives".to_string()),
                candidate_courses: pool,
                credits_needed: req.additional_electives_count as f64
                    * pools::DEFAULT_CREDITS_PER_COURSE,
            });
        }
    }

    // Generation runs best-of-K internally (in `generate_advanced`) when a
    // timetable-shape objective is active: the expensive seed-independent
    // eligibility scan is built ONCE and only the cheap seed-dependent tail
    // (shuffle + arena + pick pass + objective-aware arrangement) repeats per
    // attempt, all sharing one selection budget. So enabling an objective can't
    // multiply latency past the worker's wall-clock kill, and the priority
    // comparator already keeps the schedule that best satisfies the priorities.
    let result = advanced::generate_advanced(advanced::AdvancedParams {
        data,
        constraints: &constraints,
        objectives: &objectives,
        completed_courses: req.completed_courses.clone(),
        prereq_eligible_courses: prereq_eligible_courses.clone(),
        remaining_requirements: remaining_requirements
            .iter()
            .map(|r| pools::RemainingRequirement {
                requirement_id: r.requirement_id.clone(),
                req_type: r.req_type.clone(),
                title: r.title.clone(),
                candidate_courses: r.candidate_courses.clone(),
                credits_needed: r.credits_needed,
            })
            .collect(),
        requirement_tree: req
            .requirement_tree
            .iter()
            .map(convert_requirement_node)
            .collect(),
        constrained_per_requirement_raw: string_list_map(&req.constrained_per_requirement),
        selected_per_requirement: string_list_map(&req.selected_per_requirement),
        selected_options_per_requirement: req
            .selected_options_per_requirement
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect(),
        courses_this_semester,
        level_buckets: level_buckets.clone(),
        language_buckets: language_buckets.clone(),
        elective_level_buckets: req.elective_level_buckets.clone(),
        include_closed: req.include_closed_components,
        virtual_sections_only: req.virtual_sections_only,
        prefer_easier: objectives.prefer_easier(),
        course_aplus,
        prefer_higher_sentiment: objectives.prefer_sentiment(),
        course_sentiment,
        french_immersion_stream: req.french_immersion_stream,
        blacklisted_courses: req.blacklisted_courses.clone(),
        basic_excluded_categories: req.basic_excluded_categories.clone(),
        forced_courses: forced_courses.clone(),
        current_seed: effective_base,
        first_seed: req.first_seed,
        work_budget: advanced::SELECTION_GLOBAL_WORK_BUDGET,
    });

    generation_response(
        result.schedule,
        result.filtered_optional_pool,
        result.pinned,
        result.chosen_to_requirement.into_iter().collect(),
        result.pool_diagnostics,
        Some("no_schedule".to_string()),
    )
}

fn convert_requirement_node(
    node: &proto::engine::RequirementWithStatus,
) -> advanced::RequirementWithStatus {
    advanced::RequirementWithStatus {
        req_type: node.r#type.clone(),
        title: node.title.clone(),
        options: node.options.iter().map(convert_requirement_node).collect(),
        complete: node.complete,
        requirement_id: node.requirement_id.clone(),
        candidate_courses: node.candidate_courses.clone(),
        credits_needed: node.credits_needed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proto::engine::{GenerationRequest, GenerationResponse};

    #[test]
    fn request_response_roundtrip() {
        let req = GenerationRequest {
            additional_electives_count: 3,
            completed_courses: vec!["ITI 1120".to_string()],
            current_seed: 7,
            ..Default::default()
        };
        let bytes = req.encode_to_vec();
        let decoded = GenerationRequest::decode(bytes.as_slice()).unwrap();
        assert_eq!(decoded.additional_electives_count, 3);
        assert_eq!(decoded.completed_courses, vec!["ITI 1120".to_string()]);
        assert_eq!(decoded.current_seed, 7);
    }

    #[test]
    fn empty_catalogue_engine() {
        let cat = proto::data::Catalogue::default().encode_to_vec();
        let sched = proto::data::SchedulesData::default().encode_to_vec();
        let engine = Engine::new(&cat, &sched).unwrap();
        assert_eq!(engine.course_count(), 0);
        assert_eq!(engine.schedule_count(), 0);

        let resp_bytes = engine
            .generate(&GenerationRequest::default().encode_to_vec())
            .unwrap();
        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        // A default (basic, 0 electives) request yields a valid empty schedule.
        assert!(resp.courses.is_empty());
    }

    /// The platform-agnostic [`EngineCore`] is what the native iOS/Android binding
    /// wraps, so exercise it directly (no `wasm_bindgen` involved) to guard the
    /// seam the WASM [`Engine`] and the native binding both build on.
    #[test]
    fn engine_core_smoke() {
        let cat = proto::data::Catalogue::default().encode_to_vec();
        let sched = proto::data::SchedulesData::default().encode_to_vec();
        let core = EngineCore::new(&cat, &sched).unwrap();
        assert_eq!(core.course_count(), 0);
        assert_eq!(core.schedule_count(), 0);

        let resp_bytes = core
            .generate(&GenerationRequest::default().encode_to_vec())
            .unwrap();
        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(resp.courses.is_empty());

        // Decode failures surface as a plain `EngineError`, not a panic.
        let bad = EngineCore::new(&[0xff, 0xff, 0xff], &sched);
        assert!(bad.is_err());
    }

    /// End-to-end smoke test against the real committed `.pb` datasets: build the
    /// engine, pin a real course as a basket course, and assert the engine
    /// produces a conflict-free schedule containing it. Skipped when the build
    /// artifacts are absent (they are generated by `pnpm build:data-proto`).
    #[test]
    fn real_data_basic_generation() {
        let cat_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../apps/web/src/assets/data/catalogue.2026.pb"
        );
        let sched_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../apps/web/src/assets/data/schedules.2269.pb"
        );
        let (Ok(cat_bytes), Ok(sched_bytes)) = (std::fs::read(cat_path), std::fs::read(sched_path))
        else {
            eprintln!("skipping real_data_basic_generation: .pb artifacts not built");
            return;
        };

        let sched = proto::data::SchedulesData::decode(sched_bytes.as_slice()).unwrap();
        assert!(
            !sched.schedules.is_empty(),
            "real schedules dataset is empty"
        );
        // Find a real course code that has at least one component.
        let mut pinned_code = None;
        for s in &sched.schedules {
            if s.components.is_empty() {
                continue;
            }
            if let Some(code) = sched.course_codes.get(s.course as usize) {
                pinned_code = Some(code.clone());
                break;
            }
        }
        let pinned_code = pinned_code.expect("no schedulable course found in real data");

        let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();
        assert!(engine.course_count() > 0);
        assert!(engine.schedule_count() > 0);

        let req = GenerationRequest {
            basic_pinned_courses: vec![pinned_code.clone()],
            additional_electives_count: 0,
            courses_this_semester: 1,
            include_closed_components: true,
            current_seed: 12345,
            first_seed: 12345,
            ..Default::default()
        };
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();

        assert!(
            resp.has_schedule,
            "expected a schedule for pinned {pinned_code}"
        );
        assert_eq!(resp.courses.len(), 1, "expected exactly the pinned course");
        assert!(!resp.courses[0].components.is_empty());

        // Advanced path: force the same course as a standalone pick.
        let adv = GenerationRequest {
            forced_courses: vec![pinned_code.clone()],
            courses_this_semester: 1,
            include_closed_components: true,
            current_seed: 999,
            first_seed: 999,
            ..Default::default()
        };
        let adv_bytes = engine.generate(&adv.encode_to_vec()).unwrap();
        let adv_resp = GenerationResponse::decode(adv_bytes.as_slice()).unwrap();
        assert!(
            adv_resp.has_schedule,
            "advanced: expected a forced-course schedule"
        );
        assert_eq!(adv_resp.courses.len(), 1);
    }
}
