//! Hard-constraint checks, ported from `generation/constraints.ts` and
//! `engine/constraints/builtins.ts`. The active constraint set while timetabling
//! a fixed course set is: time-window (section), min-professor-rating (section),
//! overlap (incremental), compressed-schedule (final) and the first-year credit
//! cap (final). The blacklist is applied during *selection*, not here.

use std::collections::HashMap;

use crate::model::{first_four_digit_number, DataView};
use crate::pools::{normalize_course_credits, DEFAULT_CREDITS_PER_COURSE};
use crate::types::{Enrollment, RtSection, RtTime};

#[derive(Clone)]
pub struct Constraints {
    pub min_start: u32,
    pub max_end: u32,
    pub max_first_year_credits: Option<f64>,
    pub default_course_credits: f64,
    /// (day 0-6 Monday, start, end)
    pub blocked: Vec<(u8, u32, u32)>,
    /// normalized professor name -> rating (only rated profs present).
    pub professor_ratings: HashMap<String, f64>,
    /// When set, section selection is biased toward higher-rated professors
    /// (soft preference; see `timetable::combos`). Not a hard filter.
    pub prefer_professor_rating: bool,
}

impl Default for Constraints {
    fn default() -> Self {
        Constraints {
            min_start: 0,
            max_end: 0,
            max_first_year_credits: None,
            default_course_credits: DEFAULT_CREDITS_PER_COURSE,
            blocked: Vec::new(),
            professor_ratings: HashMap::new(),
            prefer_professor_rating: false,
        }
    }
}

impl Constraints {
    /// Whether the time-window/blocked filter is active.
    fn time_window_active(&self) -> bool {
        self.min_start > 0 || self.max_end < 24 * 60 || !self.blocked.is_empty()
    }

    fn slot_overlaps_blocked(&self, t: &RtTime) -> bool {
        for &(day, start, end) in &self.blocked {
            if day != t.day {
                continue;
            }
            if t.start < end && t.end > start {
                return true;
            }
        }
        false
    }

    fn time_slot_satisfies(&self, t: &RtTime) -> bool {
        t.start >= self.min_start
            && t.end <= self.max_end
            && !(!self.blocked.is_empty() && self.slot_overlaps_blocked(t))
    }

    /// Section-scope check: time window only. Professor rating is a soft
    /// selection preference (see `timetable::combos`), not a hard filter.
    pub fn allows_section(&self, section: &RtSection) -> bool {
        if self.time_window_active() {
            for t in &section.times {
                if t.start >= t.end {
                    continue;
                }
                if !self.time_slot_satisfies(t) {
                    return false;
                }
            }
        }
        true
    }

    /// Final-timetable check: the first-year credit cap. The compressed-schedule
    /// rule was replaced by the soft `compact` optimization objective.
    /// Operates on enrollments by reference (no per-call allocation).
    pub fn allows_final(&self, chosen: &[Enrollment], data: &DataView) -> bool {
        if let Some(cap) = self.max_first_year_credits {
            let mut total = 0.0;
            for e in chosen {
                total += first_year_credits(
                    &e.course_code,
                    data.get_course(&e.course_code).map(|c| c.credits),
                    self.default_course_credits,
                );
                if total > cap {
                    return false;
                }
            }
        }
        true
    }
}

pub fn normalize_professor_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for word in name.split_whitespace() {
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(word);
    }
    out
}

fn first_year_credits(code: &str, credits: Option<f64>, default_credits: f64) -> f64 {
    match first_four_digit_number(code) {
        Some(n) if n < 2000 => credits.unwrap_or_else(|| normalize_course_credits(default_credits)),
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::proto::data::{Catalogue, Course, SchedulesData};
    use crate::types::WeekMask;

    fn time(day: u8, start: u32, end: u32, instructor: Option<&str>) -> RtTime {
        RtTime {
            day,
            start,
            end,
            is_virtual: false,
            instructor: instructor.map(str::to_string),
            dates: None,
        }
    }

    fn section(times: Vec<RtTime>) -> RtSection {
        RtSection {
            section: "A".to_string(),
            times,
            closed: false,
        }
    }

    fn enrollment(code: &str, times: Vec<RtTime>) -> Enrollment {
        Enrollment {
            course_code: code.to_string(),
            sections: BTreeMap::new(),
            mask: WeekMask::from_times(&times),
            times,
        }
    }

    fn data_with_credits(courses: &[(&str, f64)]) -> DataView {
        let course_codes = courses
            .iter()
            .map(|(code, _)| (*code).to_string())
            .collect::<Vec<_>>();
        let courses = courses
            .iter()
            .enumerate()
            .map(|(index, (_, credits))| Course {
                code: index as u32,
                credits: *credits,
                ..Default::default()
            })
            .collect();
        DataView::new(
            Catalogue {
                course_codes,
                courses,
                ..Default::default()
            },
            SchedulesData::default(),
        )
    }

    #[test]
    fn time_window_and_blocked_slots_filter_sections() {
        let constraints = Constraints {
            min_start: 9 * 60,
            max_end: 17 * 60,
            blocked: vec![(0, 12 * 60, 13 * 60)],
            ..Default::default()
        };

        assert!(constraints.allows_section(&section(vec![time(1, 10 * 60, 11 * 60, None)])));
        assert!(!constraints.allows_section(&section(vec![time(1, 8 * 60 + 30, 10 * 60, None)])));
        assert!(!constraints.allows_section(&section(vec![time(1, 16 * 60, 17 * 60 + 30, None)])));
        assert!(!constraints.allows_section(&section(vec![time(0, 12 * 60 + 30, 14 * 60, None)])));
        assert!(constraints.allows_section(&section(vec![time(0, 13 * 60, 14 * 60, None)])));
    }

    #[test]
    fn first_year_credit_cap_counts_only_sub_2000_level_courses() {
        let data = data_with_credits(&[("CSI 1100", 3.0), ("CSI 1500", 6.0), ("CSI 2100", 3.0)]);
        let constraints = Constraints {
            max_end: 24 * 60,
            max_first_year_credits: Some(6.0),
            ..Default::default()
        };

        assert!(constraints.allows_final(
            &[
                enrollment("CSI 1100", Vec::new()),
                enrollment("CSI 2100", Vec::new()),
            ],
            &data,
        ));
        assert!(!constraints.allows_final(
            &[
                enrollment("CSI 1100", Vec::new()),
                enrollment("CSI 1500", Vec::new()),
            ],
            &data,
        ));
    }

    #[test]
    fn first_year_credit_cap_uses_school_default_for_unknown_courses() {
        let data = data_with_credits(&[]);
        let constraints = Constraints {
            max_end: 24 * 60,
            max_first_year_credits: Some(0.5),
            default_course_credits: 0.5,
            ..Default::default()
        };

        assert!(constraints.allows_final(&[enrollment("COMP 1005", Vec::new())], &data));
        assert!(!constraints.allows_final(
            &[
                enrollment("COMP 1005", Vec::new()),
                enrollment("COMP 1006", Vec::new()),
            ],
            &data,
        ));
    }
}
