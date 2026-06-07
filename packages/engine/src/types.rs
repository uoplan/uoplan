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
    /// Conservative weekly time-occupancy bitmask of `times` (5-minute slots,
    /// start floored / end ceiled to slot boundaries). Used purely as an exact
    /// fast *disjoint-reject*: if two enrollments' masks don't intersect they
    /// share no time slot and therefore cannot conflict — regardless of meeting
    /// dates. When masks DO intersect a precise [`enrollments_overlap`] check is
    /// still required (the slot might be shared only after rounding, or the
    /// overlapping times might have disjoint meeting-date ranges). This makes the
    /// mask a sound accelerator for any data, not a replacement for the exact check.
    pub mask: WeekMask,
}

/// Number of distinct days represented (Monday..Sunday).
const WEEK_MASK_DAYS: u32 = 7;
/// Minutes per occupancy slot. 5 divides every meeting-time boundary in the
/// current datasets exactly; non-aligned boundaries are handled conservatively by
/// flooring the start and ceiling the end, so correctness never depends on it.
const WEEK_MASK_SLOT_MINUTES: u32 = 5;
/// Slots per day covering a full 24h (1440 / 5 = 288).
const WEEK_MASK_SLOTS_PER_DAY: u32 = (24 * 60) / WEEK_MASK_SLOT_MINUTES;
/// `ceil(7 * 288 / 64)` = 32 u64 words (2016 bits used of 2048).
const WEEK_MASK_WORDS: usize =
    ((WEEK_MASK_DAYS * WEEK_MASK_SLOTS_PER_DAY) as usize).div_ceil(64);

/// Fixed-size weekly time-occupancy bitmask (see [`Enrollment::mask`]).
#[derive(Clone, Copy, Debug)]
pub struct WeekMask {
    words: [u64; WEEK_MASK_WORDS],
}

impl Default for WeekMask {
    fn default() -> Self {
        Self::EMPTY
    }
}

impl WeekMask {
    pub const EMPTY: WeekMask = WeekMask { words: [0; WEEK_MASK_WORDS] };

    /// Mark the half-open minute range `[start, end)` on `day` as occupied,
    /// rounding the start *down* and end *up* to slot boundaries (conservative:
    /// the mask always covers at least the real interval).
    fn set_range(&mut self, day: u8, start: u32, end: u32) {
        if start >= end {
            return;
        }
        let day = u32::from(day).min(WEEK_MASK_DAYS - 1);
        let first = (start / WEEK_MASK_SLOT_MINUTES).min(WEEK_MASK_SLOTS_PER_DAY);
        let last = end
            .div_ceil(WEEK_MASK_SLOT_MINUTES)
            .min(WEEK_MASK_SLOTS_PER_DAY);
        let base = day * WEEK_MASK_SLOTS_PER_DAY;
        for slot in first..last {
            let bit = (base + slot) as usize;
            self.words[bit / 64] |= 1u64 << (bit % 64);
        }
    }

    /// Build the occupancy mask for a set of meeting times.
    pub fn from_times(times: &[RtTime]) -> WeekMask {
        let mut m = WeekMask::EMPTY;
        for t in times {
            m.set_range(t.day, t.start, t.end);
        }
        m
    }

    /// Whether the two masks share any occupied slot. Disjoint masks guarantee the
    /// underlying enrollments share no time slot (an exact no-conflict result).
    #[inline]
    pub fn intersects(&self, other: &WeekMask) -> bool {
        self.words
            .iter()
            .zip(other.words.iter())
            .any(|(a, b)| a & b != 0)
    }

    /// Accumulate `other`'s occupied slots into `self`.
    #[inline]
    pub fn union_with(&mut self, other: &WeekMask) {
        for (a, b) in self.words.iter_mut().zip(other.words.iter()) {
            *a |= *b;
        }
    }
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
    // Exact fast reject: disjoint occupancy masks ⇒ no shared time slot ⇒ no
    // conflict, regardless of meeting dates. Only when masks intersect do we pay
    // for the precise time/date comparison.
    if !a.mask.intersects(&b.mask) {
        return false;
    }
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
