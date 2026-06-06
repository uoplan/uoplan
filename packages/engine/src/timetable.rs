//! Seeded timetabling: per-course lazy section combos, fixed-set arrangement
//! enumeration and subset (pinned + fill) enumeration. Ports
//! `engine/timetable/{lazyCombos,enumerator,subsetEnumerator}.ts` and
//! `engine/integration.ts`.

use std::collections::BTreeMap;

use crate::constraints::Constraints;
use crate::model::DataView;
use crate::rng::{shuffle_in_place, Rng};
use crate::types::{
    collect_times, has_internal_overlap, section_has_times, enrollments_overlap, Enrollment,
    RtSchedule, RtSection,
};

/// Whether the schedule has at least one conflict-free section combo under the
/// constraints. Mirrors `getValidSectionCombos(...).length > 0`.
pub fn has_valid_section_combos(schedule: &RtSchedule, constraints: &Constraints) -> bool {
    let mut section_arrays: Vec<Vec<&RtSection>> = Vec::new();
    for sections in schedule.components.values() {
        let filtered: Vec<&RtSection> = sections
            .iter()
            .filter(|s| section_has_times(s) && constraints.allows_section(s))
            .collect();
        if filtered.is_empty() {
            return false;
        }
        section_arrays.push(filtered);
    }

    fn search<'a>(idx: usize, arrays: &[Vec<&'a RtSection>], acc: &mut Vec<&'a RtSection>) -> bool {
        if idx == arrays.len() {
            return true;
        }
        for sec in &arrays[idx] {
            acc.push(sec);
            let times = collect_times(acc);
            if !has_internal_overlap(&times) && search(idx + 1, arrays, acc) {
                acc.pop();
                return true;
            }
            acc.pop();
        }
        false
    }

    let mut acc: Vec<&RtSection> = Vec::new();
    search(0, &section_arrays, &mut acc)
}

/// A course with its precomputed (seeded-ordered) valid section combos.
pub struct TimetableCourse {
    #[allow(dead_code)]
    pub code: String,
    pub combos: Vec<Enrollment>,
}

/// Resolves a course code to its effective schedule (already closed/virtual
/// filtered as appropriate for the caller).
pub trait ScheduleResolver {
    fn resolve(&self, code: &str) -> Option<RtSchedule>;
}

/// Generic resolver driven by an `include_closed` flag and a per-course
/// "virtual only" predicate (mirrors `cacheWithPerCourseVirtualFilter`).
pub struct FnResolver<'a, F: Fn(&str) -> bool> {
    pub data: &'a DataView,
    pub include_closed: bool,
    pub virtual_for: F,
}

impl<'a, F: Fn(&str) -> bool> ScheduleResolver for FnResolver<'a, F> {
    fn resolve(&self, code: &str) -> Option<RtSchedule> {
        self.data
            .effective_schedule(code, self.include_closed, (self.virtual_for)(code))
    }
}

/// Builds the seeded combos for one course. Honours projects yield a single
/// empty (timeless) combo. Returns None if the course cannot be scheduled.
pub fn build_timetable_course(
    code: &str,
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<TimetableCourse> {
    if data.is_honours_project(code) {
        return Some(TimetableCourse {
            code: data.canonical_code_str(code),
            combos: vec![Enrollment {
                course_code: data.canonical_code_str(code),
                sections: BTreeMap::new(),
                times: Vec::new(),
            }],
        });
    }

    let schedule = resolver.resolve(code)?;
    let component_keys: Vec<String> = schedule.components.keys().cloned().collect();
    let mut section_arrays: Vec<Vec<RtSection>> = Vec::with_capacity(component_keys.len());
    for key in &component_keys {
        let sections = schedule.components.get(key).unwrap();
        let mut filtered: Vec<RtSection> = sections
            .iter()
            .filter(|s| section_has_times(s) && constraints.allows_section(s))
            .cloned()
            .collect();
        if filtered.is_empty() {
            return None;
        }
        shuffle_in_place(&mut filtered, rng);
        section_arrays.push(filtered);
    }

    let total: usize = section_arrays.iter().map(|a| a.len()).product();
    let mut combos: Vec<Enrollment> = Vec::new();
    let mut indices = vec![0usize; section_arrays.len()];
    for _ in 0..total {
        let chosen: Vec<&RtSection> = section_arrays
            .iter()
            .enumerate()
            .map(|(i, arr)| &arr[indices[i]])
            .collect();
        let times = collect_times(&chosen);
        if !has_internal_overlap(&times) {
            let mut sections = BTreeMap::new();
            for (i, key) in component_keys.iter().enumerate() {
                sections.insert(key.clone(), chosen[i].section.clone());
            }
            combos.push(Enrollment {
                course_code: schedule.course_code.clone(),
                sections,
                times,
            });
        }
        // advance odometer
        for i in (0..section_arrays.len()).rev() {
            indices[i] += 1;
            if indices[i] < section_arrays[i].len() {
                break;
            }
            indices[i] = 0;
        }
    }

    if combos.is_empty() {
        None
    } else {
        Some(TimetableCourse {
            code: data.canonical_code_str(code),
            combos,
        })
    }
}

fn passes_final(chosen: &[Enrollment], constraints: &Constraints, data: &DataView) -> bool {
    let codes_times: Vec<(String, Vec<_>)> = chosen
        .iter()
        .map(|e| (e.course_code.clone(), e.times.clone()))
        .collect();
    constraints.allows_final(&codes_times, data)
}

fn allows_enrollment(candidate: &Enrollment, partial: &[Enrollment]) -> bool {
    !partial.iter().any(|e| enrollments_overlap(e, candidate))
}

/// First conflict-free arrangement of a fixed course set, or None.
pub fn first_seeded_arrangement(
    course_codes: &[String],
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<Vec<Enrollment>> {
    let mut courses: Vec<TimetableCourse> = Vec::with_capacity(course_codes.len());
    for code in course_codes {
        let tc = build_timetable_course(code, data, resolver, constraints, rng)?;
        courses.push(tc);
    }
    courses.sort_by_key(|c| c.combos.len());

    let mut chosen: Vec<Enrollment> = Vec::new();
    fn solve(
        idx: usize,
        courses: &[TimetableCourse],
        chosen: &mut Vec<Enrollment>,
        constraints: &Constraints,
        data: &DataView,
    ) -> bool {
        if idx == courses.len() {
            return passes_final(chosen, constraints, data);
        }
        for combo in &courses[idx].combos {
            if !allows_enrollment(combo, chosen) {
                continue;
            }
            chosen.push(combo.clone());
            if solve(idx + 1, courses, chosen, constraints, data) {
                return true;
            }
            chosen.pop();
        }
        false
    }

    if solve(0, &courses, &mut chosen, constraints, data) {
        Some(chosen)
    } else {
        None
    }
}

fn arrangement_fingerprint(chosen: &[Enrollment]) -> String {
    let mut parts: Vec<String> = chosen
        .iter()
        .map(|e| {
            let sections: Vec<String> = e
                .sections
                .iter()
                .map(|(k, v)| format!("{k}:{v}"))
                .collect();
            format!("{}{{{}}}", e.course_code, sections.join("|"))
        })
        .collect();
    parts.sort();
    parts.join(",")
}

/// First seeded subset timetable that pins all `pinned` and fills to
/// `target_count` from `optional` (in the given seeded order), or None.
#[allow(clippy::too_many_arguments)]
pub fn first_seeded_subset_arrangement(
    pinned: &[String],
    optional: &[String],
    target_count: usize,
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<Vec<Enrollment>> {
    if pinned.len() > target_count {
        return None;
    }

    let mut pinned_courses: Vec<TimetableCourse> = Vec::new();
    for code in pinned {
        let tc = build_timetable_course(code, data, resolver, constraints, rng)?;
        pinned_courses.push(tc);
    }

    let mut optional_courses: Vec<TimetableCourse> = Vec::new();
    for code in optional {
        if pinned.contains(code) {
            continue;
        }
        if let Some(tc) = build_timetable_course(code, data, resolver, constraints, rng) {
            optional_courses.push(tc);
        }
    }

    let mut chosen: Vec<Enrollment> = Vec::new();
    let slots = target_count - pinned_courses.len();

    fn fill_optional(
        idx: usize,
        slots_left: usize,
        optional: &[TimetableCourse],
        chosen: &mut Vec<Enrollment>,
        constraints: &Constraints,
        data: &DataView,
    ) -> bool {
        if slots_left == 0 {
            return passes_final(chosen, constraints, data);
        }
        if idx >= optional.len() {
            return false;
        }
        if optional.len() - idx < slots_left {
            return false;
        }
        for combo in &optional[idx].combos {
            if !allows_enrollment(combo, chosen) {
                continue;
            }
            chosen.push(combo.clone());
            if fill_optional(idx + 1, slots_left - 1, optional, chosen, constraints, data) {
                return true;
            }
            chosen.pop();
        }
        fill_optional(idx + 1, slots_left, optional, chosen, constraints, data)
    }

    fn place_pinned(
        idx: usize,
        pinned: &[TimetableCourse],
        optional: &[TimetableCourse],
        slots: usize,
        chosen: &mut Vec<Enrollment>,
        constraints: &Constraints,
        data: &DataView,
    ) -> bool {
        if idx == pinned.len() {
            return fill_optional(0, slots, optional, chosen, constraints, data);
        }
        for combo in &pinned[idx].combos {
            if !allows_enrollment(combo, chosen) {
                continue;
            }
            chosen.push(combo.clone());
            if place_pinned(idx + 1, pinned, optional, slots, chosen, constraints, data) {
                return true;
            }
            chosen.pop();
        }
        false
    }

    if place_pinned(
        0,
        &pinned_courses,
        &optional_courses,
        slots,
        &mut chosen,
        constraints,
        data,
    ) {
        let _ = arrangement_fingerprint(&chosen); // dedup not needed for "first"
        Some(chosen)
    } else {
        None
    }
}
