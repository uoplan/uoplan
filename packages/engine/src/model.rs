//! Course-code utilities and the in-memory data view over the decoded
//! `data.proto` datasets. Ports `utils/courseUtils.ts`, `courseFilters.ts`,
//! `dataCache.ts`, and the proto->runtime resolution from
//! `dataTypes/schedules.ts`.

use std::collections::{BTreeMap, HashMap};

use crate::proto::data::{Catalogue, Course, DayOfWeek, SchedulesData, SectionStatus};
use crate::types::{section_has_times, RtSchedule, RtSection, RtTime};

/// Normalize a course code: "amm5101" / "AMM 5101" -> "AMM 5101". Returns the
/// trimmed input unchanged when it does not match the `PREFIX NUMBER` shape.
pub fn normalize_course_code(code: &str) -> String {
    if let Some((prefix, number)) = parse_course_code(code) {
        format!("{prefix} {number}")
    } else {
        code.trim().to_string()
    }
}

/// Parses "PREFIX NUMBER" where PREFIX is 3-4 letters and NUMBER is 4-5 digits
/// with an optional trailing letter. Returns (UPPER_PREFIX, UPPER_NUMBER).
pub fn parse_course_code(code: &str) -> Option<(String, String)> {
    let trimmed = code.trim();
    let mut chars = trimmed.chars().peekable();

    let mut prefix = String::new();
    while let Some(&c) = chars.peek() {
        if c.is_ascii_alphabetic() {
            prefix.push(c.to_ascii_uppercase());
            chars.next();
        } else {
            break;
        }
    }
    if prefix.len() < 3 || prefix.len() > 4 {
        return None;
    }

    // Optional whitespace between prefix and number.
    while matches!(chars.peek(), Some(c) if c.is_whitespace()) {
        chars.next();
    }

    let mut digits = String::new();
    while matches!(chars.peek(), Some(c) if c.is_ascii_digit()) {
        digits.push(chars.next().unwrap());
    }
    if digits.len() < 4 || digits.len() > 5 {
        return None;
    }

    let mut number = digits;
    // Optional single trailing letter.
    if let Some(&c) = chars.peek() {
        if c.is_ascii_alphabetic() {
            number.push(c.to_ascii_uppercase());
            chars.next();
        }
    }

    if chars.next().is_some() {
        return None; // trailing junk
    }

    Some((prefix, number))
}

/// Subject prefix (uppercase) from a course code, e.g. "CSI 2101" -> "CSI".
pub fn subject_prefix(code: &str) -> String {
    code.split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase()
}

/// First run of 4-5 digits anywhere in the code, parsed as an integer.
fn first_numeric(code: &str) -> Option<u32> {
    let bytes = code.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_digit() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            let len = i - start;
            if (4..=5).contains(&len) {
                return code[start..i].parse().ok();
            }
        } else {
            i += 1;
        }
    }
    None
}

/// First run of exactly four consecutive digits, parsed as an integer. Mirrors
/// the TS `code.match(/\d{4}/)` used by first-year-credit and elective-bucket
/// logic (matches the first four consecutive digits anywhere in the code).
pub fn first_four_digit_number(code: &str) -> Option<u32> {
    let bytes = code.as_bytes();
    let mut i = 0;
    while i + 4 <= bytes.len() {
        if bytes[i..i + 4].iter().all(|b| b.is_ascii_digit()) {
            return code[i..i + 4].parse().ok();
        }
        i += 1;
    }
    None
}

/// Course level floored to the nearest thousand (1000, 2000, ...), or None.
pub fn course_level(code: &str) -> Option<i64> {
    let (_, number) = parse_course_code(code)?;
    let num: i64 = number
        .trim_end_matches(|c: char| c.is_ascii_alphabetic())
        .parse()
        .ok()?;
    Some((num / 1000) * 1000)
}

/// Level sort key used by candidate weighting (unknown -> 999000).
pub fn course_level_sort_key(code: &str) -> i64 {
    course_level(code).unwrap_or(999_000)
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LevelBucket {
    Undergrad,
    Grad,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LanguageBucket {
    En,
    Fr,
    Other,
}

pub fn level_bucket(code: &str) -> Option<LevelBucket> {
    let n = first_numeric(code)?;
    Some(if n >= 5000 {
        LevelBucket::Grad
    } else {
        LevelBucket::Undergrad
    })
}

pub fn language_bucket(code: &str) -> Option<LanguageBucket> {
    let n = first_numeric(code)?;
    // second digit of the numeric part
    let s = n.to_string();
    let second = s.as_bytes().get(1).map(|b| (b - b'0') as u32)?;
    Some(match second {
        1..=4 => LanguageBucket::En,
        5..=8 => LanguageBucket::Fr,
        _ => LanguageBucket::Other,
    })
}

/// Mirror of `courseMatchesFilters`. `levels`/`langs` are the allowed buckets.
pub fn course_matches_filters(
    code: &str,
    levels: &[LevelBucket],
    langs: &[LanguageBucket],
) -> bool {
    if let Some(lb) = level_bucket(code) {
        if !levels.contains(&lb) {
            return false;
        }
    }
    if let Some(lang) = language_bucket(code) {
        if !langs.contains(&lang) {
            return false;
        }
    }
    true
}

/// Language variant of a normalized code (en<->fr), or None.
pub fn language_variant(normalized_code: &str) -> Option<String> {
    let (prefix, number) = parse_course_code(normalized_code)?;
    let (digits, suffix): (&str, &str) = match number.find(|c: char| c.is_ascii_alphabetic()) {
        Some(idx) => (&number[..idx], &number[idx..]),
        None => (number.as_str(), ""),
    };
    if digits.len() != 4 {
        return None;
    }
    let n: i64 = digits.parse().ok()?;
    let hundreds = (n / 100) % 10;
    if (1..=4).contains(&hundreds) {
        Some(format!("{prefix} {}{suffix}", n + 400))
    } else if (5..=8).contains(&hundreds) {
        Some(format!("{prefix} {}{suffix}", n - 400))
    } else {
        None
    }
}

fn is_work_term(course: &Course) -> bool {
    course
        .component
        .as_deref()
        .map(|c| c.trim().to_ascii_lowercase().contains("work term"))
        .unwrap_or(false)
}

/// In-memory view over the catalogue + schedules, replacing the TS `DataCache`.
pub struct DataView {
    catalogue: Catalogue,
    /// normalized code (incl. aliases) -> index into `catalogue.courses`.
    course_index: HashMap<String, usize>,
    /// normalized code -> index into `rt_schedules`.
    schedule_index: HashMap<String, usize>,
    /// resolved canonical code string per course (parallel to catalogue.courses).
    course_code_str: Vec<String>,
    /// indices of non-work-term courses (the "eligible" set).
    eligible: Vec<usize>,
    /// runtime schedules (unfiltered) parallel to the source schedule list.
    rt_schedules: Vec<RtSchedule>,
    schedule_count: usize,
}

fn normalize_day(proto_day: i32) -> u8 {
    if proto_day <= DayOfWeek::Mo as i32 {
        0
    } else if proto_day >= DayOfWeek::Su as i32 {
        6
    } else {
        (proto_day - 1) as u8
    }
}

impl DataView {
    pub fn new(catalogue: Catalogue, schedules: SchedulesData) -> Self {
        let mut course_index: HashMap<String, usize> = HashMap::new();
        let mut course_code_str: Vec<String> = Vec::with_capacity(catalogue.courses.len());
        let mut eligible: Vec<usize> = Vec::new();

        for (i, course) in catalogue.courses.iter().enumerate() {
            let code = catalogue
                .course_codes
                .get(course.code as usize)
                .cloned()
                .unwrap_or_default();
            course_code_str.push(code.clone());

            course_index
                .entry(normalize_course_code(&code))
                .or_insert(i);
            for &alias in &course.aliases {
                if let Some(a) = catalogue.course_codes.get(alias as usize) {
                    course_index.entry(normalize_course_code(a)).or_insert(i);
                }
            }

            if !is_work_term(course) {
                eligible.push(i);
            }
        }

        let schedule_count = schedules.schedules.len();
        let mut schedule_index: HashMap<String, usize> = HashMap::new();
        let mut rt_schedules: Vec<RtSchedule> = Vec::with_capacity(schedule_count);
        for schedule in &schedules.schedules {
            let code = schedules
                .course_codes
                .get(schedule.course as usize)
                .cloned()
                .unwrap_or_default();

            let mut components: BTreeMap<String, Vec<RtSection>> = BTreeMap::new();
            for (key, list) in &schedule.components {
                let mut sections: Vec<RtSection> = Vec::with_capacity(list.items.len());
                for sec in &list.items {
                    let times = sec
                        .times
                        .iter()
                        .map(|t| RtTime {
                            day: normalize_day(t.day),
                            start: t.start_minutes,
                            end: t.end_minutes,
                            is_virtual: t.r#virtual,
                            instructor: t.instructor.clone(),
                            dates: t.meeting_dates_ref.and_then(|r| {
                                schedules
                                    .meeting_date_ranges
                                    .get(r.wrapping_sub(1) as usize)
                                    .map(|d| (d.start_yyyymmdd, d.end_yyyymmdd))
                            }),
                        })
                        .collect();
                    sections.push(RtSection {
                        section: sec.section.clone(),
                        times,
                        closed: sec.status == SectionStatus::Closed as i32,
                    });
                }
                components.insert(key.clone(), sections);
            }

            schedule_index
                .entry(normalize_course_code(&code))
                .or_insert(rt_schedules.len());
            rt_schedules.push(RtSchedule {
                course_code: code,
                components,
            });
        }

        DataView {
            catalogue,
            course_index,
            schedule_index,
            course_code_str,
            eligible,
            rt_schedules,
            schedule_count,
        }
    }

    pub fn get_course(&self, code: &str) -> Option<&Course> {
        let idx = *self.course_index.get(&normalize_course_code(code))?;
        self.catalogue.courses.get(idx)
    }

    /// Canonical code string for a course code (resolves aliases), normalized.
    pub fn resolve_to_canonical(&self, code: &str) -> String {
        let norm = normalize_course_code(code);
        match self.course_index.get(&norm) {
            Some(&idx) => normalize_course_code(&self.course_code_str[idx]),
            None => norm,
        }
    }

    /// Canonical (catalogue) code string for a course code, preserving its
    /// original formatting from the catalogue. Falls back to the input.
    pub fn canonical_code_str(&self, code: &str) -> String {
        match self.course_index.get(&normalize_course_code(code)) {
            Some(&idx) => self.course_code_str[idx].clone(),
            None => code.to_string(),
        }
    }

    fn raw_schedule(&self, code: &str) -> Option<&RtSchedule> {
        let idx = *self.schedule_index.get(&normalize_course_code(code))?;
        self.rt_schedules.get(idx)
    }

    /// Effective schedule used for eligibility/generation. Drops Closed sections
    /// when `include_closed` is false, and strips non-virtual times when
    /// `virtual_only` is true. Returns None if any component becomes empty.
    pub fn effective_schedule(
        &self,
        code: &str,
        include_closed: bool,
        virtual_only: bool,
    ) -> Option<RtSchedule> {
        let base = self.raw_schedule(code)?;
        let mut components: BTreeMap<String, Vec<RtSection>> = BTreeMap::new();
        for (key, sections) in &base.components {
            let mut kept: Vec<RtSection> = Vec::new();
            for sec in sections {
                if !include_closed && sec.closed {
                    continue;
                }
                if virtual_only {
                    let times: Vec<RtTime> =
                        sec.times.iter().filter(|t| t.is_virtual).cloned().collect();
                    if times.is_empty() {
                        continue;
                    }
                    kept.push(RtSection {
                        section: sec.section.clone(),
                        times,
                        closed: sec.closed,
                    });
                } else {
                    kept.push(sec.clone());
                }
            }
            if kept.is_empty() {
                return None;
            }
            components.insert(key.clone(), kept);
        }
        Some(RtSchedule {
            course_code: base.course_code.clone(),
            components,
        })
    }

    pub fn all_courses(&self) -> impl Iterator<Item = (&str, &Course)> {
        self.eligible
            .iter()
            .map(move |&i| (self.course_code_str[i].as_str(), &self.catalogue.courses[i]))
    }

    pub fn credits(&self, code: &str) -> f64 {
        self.get_course(code).map(|c| c.credits).unwrap_or(3.0)
    }

    pub fn is_honours_project(&self, code: &str) -> bool {
        match self.course_index.get(&normalize_course_code(code)) {
            Some(&idx) => self.course_code_str[idx].ends_with("900"),
            None => false,
        }
    }

    /// Whether a course cannot be placed on a timetable: it is an honours/
    /// research project (the legacy `ends_with("900")` rule, kept so those
    /// courses stay timeless even when the registrar lists a stray orientation
    /// time), OR it has a schedule entry whose sections (across every component)
    /// carry no real meeting time. Such courses — honours theses, STG
    /// placements, co-op/work terms, research/seminar requirements, etc. —
    /// satisfy a requirement without occupying a timetable slot, so the
    /// timetabler emits a single empty ("timeless") combo for them instead of
    /// failing the whole arrangement.
    ///
    /// This is a strict superset of the old `is_honours_project` override on the
    /// scheduling path: it additionally covers the ~900 no-time courses that do
    /// not end in 900 (placements, theses, co-op) which would otherwise make any
    /// schedule that includes them unbuildable. `is_honours_project` is retained
    /// on its own for implicit-honours *inference* (auto-pinning a thesis), a
    /// distinct concern from schedulability.
    ///
    /// A course with no schedule entry at all is treated as timeless only when
    /// it is an honours project (preserving prior behaviour); other missing
    /// courses keep failing the normal resolve path rather than silently
    /// becoming free picks.
    pub fn is_timeless_course(&self, code: &str) -> bool {
        if self.is_honours_project(code) {
            return true;
        }
        match self.raw_schedule(code) {
            Some(schedule) => !schedule
                .components
                .values()
                .any(|sections| sections.iter().any(section_has_times)),
            None => false,
        }
    }

    pub fn course_count(&self) -> usize {
        self.catalogue.courses.len()
    }

    pub fn schedule_count(&self) -> usize {
        self.schedule_count
    }
}
