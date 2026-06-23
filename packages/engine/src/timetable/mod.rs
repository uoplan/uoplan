//! Seeded timetabling: per-course lazy section combos, fixed-set arrangement
//! enumeration and subset (pinned + fill) enumeration. Ports
//! `engine/timetable/{lazyCombos,enumerator,subsetEnumerator}.ts` and
//! `engine/integration.ts`.

mod budgets;
mod combos;
mod search;
mod solver;

#[cfg(test)]
mod tests;

use crate::constraints::Constraints;
use crate::model::DataView;
use crate::types::Enrollment;

pub use combos::{build_timetable_course, has_valid_section_combos, FnResolver, TimetableCourse};
pub use search::{arrange_prebuilt_with_budget, best_seeded_arrangement, first_seeded_arrangement};
pub(crate) use solver::{allows_enrollment, passes_final};

pub fn arrange_prebuilt(
    courses: &[&TimetableCourse],
    constraints: &Constraints,
    data: &DataView,
) -> Option<Vec<Enrollment>> {
    search::arrange_prebuilt(courses, constraints, data)
}
