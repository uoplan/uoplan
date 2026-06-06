//! Runtime scheduling types, decoupled from the proto wire types. These mirror
//! the TS `CourseSchedule`/`ComponentSection`/`MeetingTime`/`TimeSlot` runtime
//! shapes (after proto decode in `dataTypes/schedules.ts`).

use std::collections::BTreeMap;

/// A single meeting time. `day` is normalized to 0 = Monday ... 6 = Sunday.
#[derive(Clone, Debug)]
pub struct RtTime {
    pub day: u8,
    pub start: u32,
    pub end: u32,
    pub is_virtual: bool,
    pub instructor: Option<String>,
    /// (start_yyyymmdd, end_yyyymmdd) when present.
    pub dates: Option<(u32, u32)>,
}

#[derive(Clone, Debug)]
pub struct RtSection {
    pub section: String,
    pub times: Vec<RtTime>,
    pub closed: bool,
}

#[derive(Clone, Debug)]
pub struct RtSchedule {
    pub course_code: String,
    /// component key -> sections. BTreeMap keeps components in sorted order,
    /// matching the TS `Object.keys(...).sort()`.
    pub components: BTreeMap<String, Vec<RtSection>>,
}

/// A course enrollment: chosen section per component plus the flattened times.
#[derive(Clone, Debug)]
pub struct Enrollment {
    pub course_code: String,
    /// component key -> chosen section id.
    pub sections: BTreeMap<String, String>,
    pub times: Vec<RtTime>,
}

/// True when the section has at least one real (start < end) meeting time.
pub fn section_has_times(section: &RtSection) -> bool {
    section.times.iter().any(|t| t.start < t.end)
}

/// Whether two times overlap (ported from `timesOverlap`).
pub fn times_overlap(a: &RtTime, b: &RtTime) -> bool {
    if a.day != b.day {
        return false;
    }
    if !(a.start < b.end && b.start < a.end) {
        return false;
    }
    match (a.dates, b.dates) {
        (Some((as_, ae)), Some((bs, be))) => as_ <= be && bs <= ae,
        _ => true,
    }
}

/// Collect all real time slots across the given sections.
pub fn collect_times(sections: &[&RtSection]) -> Vec<RtTime> {
    let mut out = Vec::new();
    for s in sections {
        for t in &s.times {
            if t.start < t.end {
                out.push(t.clone());
            }
        }
    }
    out
}

pub fn enrollments_overlap(a: &Enrollment, b: &Enrollment) -> bool {
    for ta in &a.times {
        for tb in &b.times {
            if times_overlap(ta, tb) {
                return true;
            }
        }
    }
    false
}

pub fn has_internal_overlap(times: &[RtTime]) -> bool {
    for i in 0..times.len() {
        for j in (i + 1)..times.len() {
            if times_overlap(&times[i], &times[j]) {
                return true;
            }
        }
    }
    false
}
