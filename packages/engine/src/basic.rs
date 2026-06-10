//! Basic-mode generation, ported from `generateSchedule/basic.ts`.

use std::collections::HashMap;

use crate::constraints::Constraints;
use crate::model::{
    course_matches_filters, normalize_course_code, subject_prefix, DataView, LanguageBucket,
    LevelBucket,
};
use crate::pools::is_within_elective_level_buckets;
use crate::prereq::{build_prereq_context, can_take_course};
use crate::rng::{scramble_seed, shuffle_in_place, weighted_random_pick_index, Rng};
use crate::timetable::{first_seeded_subset_arrangement, has_valid_section_combos, FnResolver};
use crate::types::Enrollment;
use crate::weights::{easier_weight, sentiment_weight};

pub struct BasicParams<'a> {
    pub data: &'a DataView,
    pub constraints: &'a Constraints,
    pub pinned: Vec<String>,
    pub completed_courses: Vec<String>,
    pub student_programs: Vec<String>,
    pub level_buckets: Vec<LevelBucket>,
    pub language_buckets: Vec<LanguageBucket>,
    pub elective_level_buckets: Vec<u32>,
    pub basic_excluded_categories: Vec<String>,
    pub basic_electives_count: usize,
    pub include_closed: bool,
    pub virtual_sections_only: bool,
    pub prefer_easier: bool,
    pub course_aplus: &'a HashMap<String, f64>,
    pub prefer_higher_sentiment: bool,
    pub course_sentiment: &'a HashMap<String, f64>,
    pub blacklisted_courses: Vec<String>,
    pub current_seed: u32,
    pub first_seed: u32,
}

pub struct BasicResult {
    pub schedule: Option<Vec<Enrollment>>,
    pub optional_pool: Vec<String>,
}

/// Combined soft selection multiplier (prefer-easier × prefer-higher-sentiment).
fn selection_weight(
    code: &str,
    prefer_easier: bool,
    aplus: &HashMap<String, f64>,
    prefer_higher_sentiment: bool,
    sentiment: &HashMap<String, f64>,
) -> f64 {
    easier_weight(code, prefer_easier, aplus)
        * sentiment_weight(code, prefer_higher_sentiment, sentiment)
}

fn reorder_optional_pool(
    codes: &mut Vec<String>,
    prefer_easier: bool,
    aplus: &HashMap<String, f64>,
    prefer_higher_sentiment: bool,
    sentiment: &HashMap<String, f64>,
    rng: &mut Rng,
) {
    if codes.len() <= 1 {
        return;
    }
    if !prefer_easier && !prefer_higher_sentiment {
        shuffle_in_place(codes, rng);
        return;
    }
    let mut remaining = std::mem::take(codes);
    while !remaining.is_empty() {
        let weights: Vec<f64> = remaining
            .iter()
            .map(|c| selection_weight(c, prefer_easier, aplus, prefer_higher_sentiment, sentiment))
            .collect();
        let idx = weighted_random_pick_index(&weights, rng);
        codes.push(remaining.remove(idx));
    }
}

pub fn generate_basic(params: BasicParams) -> BasicResult {
    let BasicParams {
        data,
        constraints,
        pinned,
        completed_courses,
        student_programs,
        level_buckets,
        language_buckets,
        elective_level_buckets,
        basic_excluded_categories,
        basic_electives_count,
        include_closed,
        virtual_sections_only,
        prefer_easier,
        course_aplus,
        prefer_higher_sentiment,
        course_sentiment,
        blacklisted_courses,
        current_seed,
        first_seed,
    } = params;

    let pinned_norm: Vec<String> = pinned.iter().map(|c| normalize_course_code(c)).collect();
    let effective_seed = if current_seed != 0 {
        current_seed
    } else {
        first_seed
    };
    let mut rng = Rng::new(scramble_seed(effective_seed));

    let target_count = pinned.len() + basic_electives_count;
    let blacklisted: Vec<String> = blacklisted_courses
        .iter()
        .map(|c| normalize_course_code(c))
        .collect();
    let excluded_prefixes: Vec<String> = basic_excluded_categories
        .iter()
        .map(|c| c.to_ascii_lowercase())
        .collect();

    let prereq_ctx = build_prereq_context(&completed_courses, data, &student_programs);
    let completed_has = !completed_courses.is_empty();

    let mut optional_pool: Vec<String> = Vec::new();
    let mut candidates: Vec<(String, bool, bool)> = Vec::new();
    for (code, course) in data.all_courses() {
        candidates.push((
            code.to_string(),
            course.has_prereq_text,
            course.prerequisites.is_some(),
        ));
    }

    for (code, has_prereq_text, has_prereqs) in &candidates {
        let code = code.as_str();
        if !course_matches_filters(code, &level_buckets, &language_buckets) {
            continue;
        }
        if !is_within_elective_level_buckets(code, &elective_level_buckets) {
            continue;
        }
        let prefix = subject_prefix(code).to_ascii_lowercase();
        if excluded_prefixes.contains(&prefix) {
            continue;
        }

        if completed_has {
            if *has_prereqs {
                if !can_take_course(code, data, &prereq_ctx) {
                    continue;
                }
            } else if *has_prereq_text {
                continue;
            }
        } else if *has_prereqs || *has_prereq_text {
            continue;
        }

        if pinned.iter().any(|p| p == code) {
            continue;
        }
        if blacklisted.contains(&normalize_course_code(code)) {
            continue;
        }

        let virtual_only =
            virtual_sections_only && !pinned_norm.contains(&normalize_course_code(code));
        let sched = match data.effective_schedule(code, include_closed, virtual_only) {
            Some(s) => s,
            None => continue,
        };
        if !has_valid_section_combos(&sched, constraints) {
            continue;
        }
        optional_pool.push(code.to_string());
    }

    reorder_optional_pool(
        &mut optional_pool,
        prefer_easier,
        course_aplus,
        prefer_higher_sentiment,
        course_sentiment,
        &mut rng,
    );

    let resolver = FnResolver {
        data,
        include_closed,
        virtual_for: |code: &str| {
            virtual_sections_only && !pinned_norm.contains(&normalize_course_code(code))
        },
    };
    let mut arrangement_rng = Rng::new(scramble_seed(effective_seed) ^ 0x9e37_79b9);
    let schedule = first_seeded_subset_arrangement(
        &pinned,
        &optional_pool,
        target_count,
        data,
        &resolver,
        constraints,
        &mut arrangement_rng,
    );

    BasicResult {
        schedule,
        optional_pool,
    }
}
