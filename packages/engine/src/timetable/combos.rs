use std::collections::BTreeMap;

use crate::constraints::Constraints;
use crate::model::DataView;
use crate::rng::{shuffle_in_place, Rng};
use crate::types::{
    collect_times, has_internal_overlap, section_has_times, Enrollment, RtSchedule, RtSection,
    WeekMask,
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
            combos: vec![Enrollment {
                course_code: data.canonical_code_str(code),
                sections: BTreeMap::new(),
                times: Vec::new(),
                mask: WeekMask::EMPTY,
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
                mask: WeekMask::from_times(&times),
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
        Some(TimetableCourse { combos })
    }
}
