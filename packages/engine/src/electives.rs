//! Broad-elective candidate expansion, shared by the unified generation path.
//!
//! When the user runs a pure-basket request (a set of pinned courses plus "fill
//! N electives", with no degree program active) there is no requirement tree to
//! draw a candidate pool from. This module scans the whole catalogue and applies
//! the same filters the old basic mode used — level/language buckets, the
//! per-elective level buckets, excluded subject prefixes, prerequisite
//! eligibility, the blacklist, and schedulability — to produce the candidate
//! list for a single synthesized `free_elective` requirement pool. The advanced
//! path then selects + timetables from that pool exactly like any other broad
//! elective requirement, so there is one generation code path.
//!
//! Lives in the engine (not TS) because it needs `data.all_courses()` and the
//! prerequisite graph.

use crate::constraints::Constraints;
use crate::model::{
    course_matches_filters, normalize_course_code, subject_prefix, DataView, LanguageBucket,
    LevelBucket,
};
use crate::pools::is_within_elective_level_buckets;
use crate::prereq::{build_prereq_context, can_take_course};
use crate::timetable::has_valid_section_combos;

pub struct ElectivePoolParams<'a> {
    pub data: &'a DataView,
    pub constraints: &'a Constraints,
    /// Pinned/basket courses — excluded from the elective pool (they're forced).
    pub pinned: &'a [String],
    pub completed_courses: &'a [String],
    pub student_programs: &'a [String],
    pub level_buckets: &'a [LevelBucket],
    pub language_buckets: &'a [LanguageBucket],
    pub elective_level_buckets: &'a [u32],
    pub excluded_categories: &'a [String],
    pub blacklisted_courses: &'a [String],
    pub include_closed: bool,
    pub virtual_sections_only: bool,
}

/// Build the eligible, schedulable elective candidate pool for a pure-basket
/// request. Mirrors the old `generate_basic` candidate scan (filters + prereq
/// eligibility + schedulability); the returned order is catalogue order — the
/// advanced selector applies its own seeded / preference-weighted ordering, so
/// no reordering is done here.
pub fn expand_elective_pool(p: &ElectivePoolParams) -> Vec<String> {
    let blacklisted: Vec<String> = p
        .blacklisted_courses
        .iter()
        .map(|c| normalize_course_code(c))
        .collect();
    let excluded_prefixes: Vec<String> = p
        .excluded_categories
        .iter()
        .map(|c| c.to_ascii_lowercase())
        .collect();

    let prereq_ctx = build_prereq_context(p.completed_courses, p.data, p.student_programs);
    let completed_has = !p.completed_courses.is_empty();

    let mut pool: Vec<String> = Vec::new();
    for (code, course) in p.data.all_courses() {
        let has_prereq_text = course.has_prereq_text;
        let has_prereqs = course.prerequisites.is_some();

        if !course_matches_filters(code, p.level_buckets, p.language_buckets) {
            continue;
        }
        if !is_within_elective_level_buckets(code, p.elective_level_buckets) {
            continue;
        }
        let prefix = subject_prefix(code).to_ascii_lowercase();
        if excluded_prefixes.contains(&prefix) {
            continue;
        }

        if completed_has {
            if has_prereqs {
                if !can_take_course(code, p.data, &prereq_ctx) {
                    continue;
                }
            } else if has_prereq_text {
                continue;
            }
        } else if has_prereqs || has_prereq_text {
            continue;
        }

        if p.pinned.iter().any(|pin| pin == code) {
            continue;
        }
        if blacklisted.contains(&normalize_course_code(code)) {
            continue;
        }

        let sched = match p
            .data
            .effective_schedule(code, p.include_closed, p.virtual_sections_only)
        {
            Some(s) => s,
            None => continue,
        };
        if !has_valid_section_combos(&sched, p.constraints) {
            continue;
        }
        pool.push(code.to_string());
    }
    pool
}
