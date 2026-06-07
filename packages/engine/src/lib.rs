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
mod basic;
mod constraints;
mod model;
mod pools;
mod prereq;
mod rng;
mod timetable;
mod types;

use constraints::Constraints;
use model::{DataView, LanguageBucket, LevelBucket};
use proto::engine::{
    ChosenCourse, ComponentChoice, EmptyPool, GenerationRequest, GenerationResponse, Mode,
    PoolDiagnostics,
};
use types::Enrollment;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// The schedule-generation engine. Decode the catalogue + schedule datasets
/// once, then call [`Engine::generate`] with a serialized [`GenerationRequest`].
#[wasm_bindgen]
pub struct Engine {
    data: DataView,
}

#[wasm_bindgen]
impl Engine {
    /// Construct an engine from the `catalogue.pb` and schedules `.pb` bytes.
    #[wasm_bindgen(constructor)]
    pub fn new(catalogue: &[u8], schedules: &[u8]) -> Result<Engine, JsError> {
        let catalogue = proto::data::Catalogue::decode(catalogue)
            .map_err(|e| JsError::new(&format!("failed to decode catalogue: {e}")))?;
        let schedules = proto::data::SchedulesData::decode(schedules)
            .map_err(|e| JsError::new(&format!("failed to decode schedules: {e}")))?;
        Ok(Engine {
            data: DataView::new(catalogue, schedules),
        })
    }

    /// Generate a schedule for the given serialized [`GenerationRequest`],
    /// returning a serialized [`GenerationResponse`].
    #[wasm_bindgen]
    pub fn generate(&self, request: &[u8]) -> Result<Vec<u8>, JsError> {
        let request = GenerationRequest::decode(request)
            .map_err(|e| JsError::new(&format!("failed to decode request: {e}")))?;
        let response = run_generation(&self.data, request);
        Ok(response.encode_to_vec())
    }

    /// Number of courses in the loaded catalogue (smoke-test accessor).
    #[wasm_bindgen(getter)]
    pub fn course_count(&self) -> usize {
        self.data.course_count()
    }

    /// Number of course schedules loaded (smoke-test accessor).
    #[wasm_bindgen(getter)]
    pub fn schedule_count(&self) -> usize {
        self.data.schedule_count()
    }

    /// Re-timetable a FIXED set of courses (the UI swap feature). Decodes a
    /// serialized [`TimetableRequest`] and returns a serialized
    /// [`GenerationResponse`] (`has_schedule` + the chosen section per course).
    #[wasm_bindgen]
    pub fn timetable_fixed_set(&self, request: &[u8]) -> Result<Vec<u8>, JsError> {
        let req = proto::engine::TimetableRequest::decode(request)
            .map_err(|e| JsError::new(&format!("failed to decode timetable request: {e}")))?;
        let response = run_timetable_fixed_set(&self.data, req);
        Ok(response.encode_to_vec())
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

fn build_constraints(req: &GenerationRequest) -> Constraints {
    constraints_from(req.constraints.as_ref(), &req.professor_ratings)
}

fn constraints_from(
    gc: Option<&proto::engine::GenerationConstraints>,
    professor_ratings: &HashMap<String, f64>,
) -> Constraints {
    let mut c = Constraints {
        professor_ratings: professor_ratings.clone(),
        ..Default::default()
    };
    if let Some(gc) = gc {
        c.min_start = gc.min_start_minutes;
        c.max_end = if gc.max_end_minutes == 0 {
            24 * 60
        } else {
            gc.max_end_minutes
        };
        c.min_professor_rating = gc.min_professor_rating;
        c.max_first_year_credits = gc.max_first_year_credits;
        c.compressed = gc.compressed_schedule;
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
    let constraints = constraints_from(req.constraints.as_ref(), &req.professor_ratings);

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
        virtual_for: |code: &str| virtual_only && !exempt.contains(&model::normalize_course_code(code)),
    };

    let mut rng = rng::Rng::new(rng::scramble_seed(req.seed) ^ 0x9e37_79b9);
    let schedule =
        timetable::first_seeded_arrangement(&req.course_codes, data, &resolver, &constraints, &mut rng);

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

fn run_generation(data: &DataView, req: GenerationRequest) -> GenerationResponse {
    let constraints = build_constraints(&req);
    let course_aplus = &req.course_aplus;
    let course_sentiment = &req.course_sentiment;

    if req.mode == Mode::Basic as i32 {
        let result = basic::generate_basic(basic::BasicParams {
            data,
            constraints: &constraints,
            pinned: req.basic_pinned_courses.clone(),
            completed_courses: req.completed_courses.clone(),
            student_programs: req.student_programs.clone(),
            level_buckets: level_buckets_from(&req.level_buckets),
            language_buckets: language_buckets_from(&req.language_buckets),
            elective_level_buckets: req.elective_level_buckets.clone(),
            basic_excluded_categories: req.basic_excluded_categories.clone(),
            basic_electives_count: req.basic_electives_count as usize,
            include_closed: req.include_closed_components,
            virtual_sections_only: req.virtual_sections_only,
            prefer_easier: req.generation_prefer_easier,
            course_aplus,
            prefer_higher_sentiment: req.generation_prefer_higher_sentiment,
            course_sentiment,
            blacklisted_courses: req.blacklisted_courses.clone(),
            current_seed: req.current_seed,
            first_seed: req.first_seed,
        });

        let has_schedule = result.schedule.is_some();
        return GenerationResponse {
            has_schedule,
            courses: result
                .schedule
                .as_ref()
                .map(|s| s.iter().map(enrollment_to_chosen).collect())
                .unwrap_or_default(),
            optional_pool: result.optional_pool,
            pinned: req.basic_pinned_courses.clone(),
            chosen_course_to_requirement: HashMap::new(),
            pool_diagnostics: None,
            error: if has_schedule {
                None
            } else {
                Some("no_schedule".to_string())
            },
        };
    }

    let result = advanced::generate_advanced(advanced::AdvancedParams {
        data,
        constraints: &constraints,
        completed_courses: req.completed_courses.clone(),
        prereq_eligible_courses: req.prereq_eligible_courses.clone(),
        remaining_requirements: req
            .remaining_requirements
            .iter()
            .map(|r| pools::RemainingRequirement {
                requirement_id: r.requirement_id.clone(),
                req_type: r.r#type.clone(),
                title: r.title.clone(),
                candidate_courses: r.candidate_courses.clone(),
                credits_needed: r.credits_needed.unwrap_or(0.0),
                satisfied_by: r.satisfied_by.clone(),
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
        courses_this_semester: req.courses_this_semester as usize,
        level_buckets: level_buckets_from(&req.level_buckets),
        language_buckets: language_buckets_from(&req.language_buckets),
        elective_level_buckets: req.elective_level_buckets.clone(),
        include_closed: req.include_closed_components,
        virtual_sections_only: req.virtual_sections_only,
        prefer_easier: req.generation_prefer_easier,
        course_aplus,
        prefer_higher_sentiment: req.generation_prefer_higher_sentiment,
        course_sentiment,
        french_immersion_stream: req.french_immersion_stream,
        blacklisted_courses: req.blacklisted_courses.clone(),
        basic_excluded_categories: req.basic_excluded_categories.clone(),
        forced_courses: req.forced_courses.clone(),
        current_seed: req.current_seed,
        first_seed: req.first_seed,
    });

    let has_schedule = result.schedule.is_some();
    GenerationResponse {
        has_schedule,
        courses: result
            .schedule
            .as_ref()
            .map(|s| s.iter().map(enrollment_to_chosen).collect())
            .unwrap_or_default(),
        optional_pool: result.filtered_optional_pool,
        pinned: result.pinned,
        chosen_course_to_requirement: result.chosen_to_requirement.into_iter().collect(),
        pool_diagnostics: result.pool_diagnostics.map(|d| PoolDiagnostics {
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
        error: if has_schedule {
            None
        } else {
            Some("no_schedule".to_string())
        },
    }
}

fn convert_requirement_node(
    node: &proto::engine::RequirementWithStatus,
) -> advanced::RequirementWithStatus {
    advanced::RequirementWithStatus {
        req_type: node.r#type.clone(),
        title: node.title.clone(),
        options: node.options.iter().map(convert_requirement_node).collect(),
        complete: node.complete,
        satisfied_by: node.satisfied_by.clone(),
        requirement_id: node.requirement_id.clone(),
        candidate_courses: node.candidate_courses.clone(),
        credits_needed: node.credits_needed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proto::engine::{GenerationRequest, GenerationResponse, Mode};

    #[test]
    fn request_response_roundtrip() {
        let req = GenerationRequest {
            mode: Mode::Advanced as i32,
            basic_electives_count: 3,
            completed_courses: vec!["ITI 1120".to_string()],
            current_seed: 7,
            ..Default::default()
        };
        let bytes = req.encode_to_vec();
        let decoded = GenerationRequest::decode(bytes.as_slice()).unwrap();
        assert_eq!(decoded.mode, Mode::Advanced as i32);
        assert_eq!(decoded.basic_electives_count, 3);
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

    /// End-to-end smoke test against the real committed `.pb` datasets: build the
    /// engine, pin a real course in basic mode, and assert the engine produces a
    /// conflict-free schedule containing it. Skipped when the build artifacts are
    /// absent (they are generated by `pnpm build:data-proto`).
    #[test]
    fn real_data_basic_generation() {
        let cat_path =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../apps/web/src/assets/data/catalogue.2026.pb");
        let sched_path =
            concat!(env!("CARGO_MANIFEST_DIR"), "/../../apps/web/src/assets/data/schedules.2269.pb");
        let (Ok(cat_bytes), Ok(sched_bytes)) =
            (std::fs::read(cat_path), std::fs::read(sched_path))
        else {
            eprintln!("skipping real_data_basic_generation: .pb artifacts not built");
            return;
        };

        let sched = proto::data::SchedulesData::decode(sched_bytes.as_slice()).unwrap();
        assert!(!sched.schedules.is_empty(), "real schedules dataset is empty");
        // Find a real course code that has at least one component.
        let mut pinned_code = None;
        for s in &sched.schedules {
            if s.components.is_empty() {
                continue;
            }
            if let Some(ci) = &s.course {
                if let Some(code) = sched.course_codes.get(ci.index as usize) {
                    pinned_code = Some(code.clone());
                    break;
                }
            }
        }
        let pinned_code = pinned_code.expect("no schedulable course found in real data");

        let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();
        assert!(engine.course_count() > 0);
        assert!(engine.schedule_count() > 0);

        let req = GenerationRequest {
            mode: Mode::Basic as i32,
            basic_pinned_courses: vec![pinned_code.clone()],
            basic_electives_count: 0,
            include_closed_components: true,
            current_seed: 12345,
            first_seed: 12345,
            ..Default::default()
        };
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();

        assert!(resp.has_schedule, "expected a schedule for pinned {pinned_code}");
        assert_eq!(resp.courses.len(), 1, "expected exactly the pinned course");
        assert!(!resp.courses[0].components.is_empty());

        // Advanced mode: force the same course as a standalone pick.
        let adv = GenerationRequest {
            mode: Mode::Advanced as i32,
            forced_courses: vec![pinned_code.clone()],
            courses_this_semester: 1,
            include_closed_components: true,
            current_seed: 999,
            first_seed: 999,
            ..Default::default()
        };
        let adv_bytes = engine.generate(&adv.encode_to_vec()).unwrap();
        let adv_resp = GenerationResponse::decode(adv_bytes.as_slice()).unwrap();
        assert!(adv_resp.has_schedule, "advanced: expected a forced-course schedule");
        assert_eq!(adv_resp.courses.len(), 1);
    }
}
