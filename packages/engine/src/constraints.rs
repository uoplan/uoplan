//! Hard-constraint checks, ported from `generation/constraints.ts` and
//! `engine/constraints/builtins.ts`. The active constraint set while timetabling
//! a fixed course set is: time-window (section), min-professor-rating (section),
//! overlap (incremental), compressed-schedule (final) and the first-year credit
//! cap (final). The blacklist is applied during *selection*, not here.

use std::collections::HashMap;

use crate::model::{first_four_digit_number, DataView};
use crate::types::{Enrollment, RtSection, RtTime};

#[derive(Clone, Default)]
pub struct Constraints {
    pub min_start: u32,
    pub max_end: u32,
    pub min_professor_rating: Option<f64>,
    pub max_first_year_credits: Option<f64>,
    pub compressed: bool,
    /// (day 0-6 Monday, start, end)
    pub blocked: Vec<(u8, u32, u32)>,
    /// normalized professor name -> rating (only rated profs present).
    pub professor_ratings: HashMap<String, f64>,
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

    /// Section-scope check: time window + min professor rating.
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
        self.section_allowed_by_min_rating(section)
    }

    fn section_allowed_by_min_rating(&self, section: &RtSection) -> bool {
        let min = match self.min_professor_rating {
            Some(m) if m > 0.0 && m.is_finite() => m,
            _ => return true,
        };
        let mut seen: Vec<String> = Vec::new();
        let mut ratings: Vec<f64> = Vec::new();
        for t in &section.times {
            if let Some(name) = &t.instructor {
                let key = normalize_professor_name(name);
                if key.is_empty() || seen.contains(&key) {
                    continue;
                }
                seen.push(key.clone());
                if let Some(&r) = self.professor_ratings.get(&key) {
                    if r.is_finite() {
                        ratings.push(r);
                    }
                }
            }
        }
        if ratings.is_empty() {
            return true; // no rating => always allowed
        }
        ratings.iter().all(|&r| r >= min)
    }

    /// Final-timetable check: compressed schedule + first-year credit cap.
    /// Operates on enrollments by reference (no per-call allocation).
    pub fn allows_final(&self, chosen: &[Enrollment], data: &DataView) -> bool {
        if self.compressed && !satisfies_compressed(chosen) {
            return false;
        }
        if let Some(cap) = self.max_first_year_credits {
            let mut total = 0.0;
            for e in chosen {
                total += first_year_credits(
                    &e.course_code,
                    data.get_course(&e.course_code).map(|c| c.credits),
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

fn first_year_credits(code: &str, credits: Option<f64>) -> f64 {
    match first_four_digit_number(code) {
        Some(n) if n < 2000 => credits.unwrap_or(3.0),
        _ => 0.0,
    }
}

fn satisfies_compressed(chosen: &[Enrollment]) -> bool {
    let mut by_day: HashMap<u8, Vec<(u32, u32)>> = HashMap::new();
    for e in chosen {
        for t in &e.times {
            by_day.entry(t.day).or_default().push((t.start, t.end));
        }
    }
    for times in by_day.values_mut() {
        if times.len() <= 1 {
            continue;
        }
        times.sort_by_key(|&(s, _)| s);
        let mut gap_count = 0;
        for i in 0..times.len() - 1 {
            let cur_end = times[i].1;
            let next_start = times[i + 1].0;
            if next_start > cur_end {
                let gap = next_start - cur_end;
                if gap > 0 {
                    gap_count += 1;
                    if gap_count > 1 || gap > 90 {
                        return false;
                    }
                }
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use std::collections::{BTreeMap, HashMap};

    use super::*;
    use crate::proto::data::{Catalogue, Course, CourseIndex, SchedulesData};
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
                code: Some(CourseIndex {
                    index: index as u32,
                }),
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
    fn unrated_professors_do_not_fail_min_rating_but_low_rated_ones_do() {
        let constraints = Constraints {
            min_start: 0,
            max_end: 24 * 60,
            min_professor_rating: Some(4.0),
            professor_ratings: HashMap::from([
                ("Prof Good".to_string(), 4.7),
                ("Prof Low".to_string(), 3.2),
            ]),
            ..Default::default()
        };

        assert!(constraints.allows_section(&section(vec![time(
            0,
            9 * 60,
            10 * 60,
            Some("  Prof   Good  "),
        )])));
        assert!(constraints.allows_section(&section(vec![time(
            0,
            9 * 60,
            10 * 60,
            Some("Unknown Professor"),
        )])));
        assert!(!constraints.allows_section(&section(vec![time(
            0,
            9 * 60,
            10 * 60,
            Some("Prof Low"),
        )])));
        assert!(!constraints.allows_section(&section(vec![
            time(0, 9 * 60, 10 * 60, Some("Prof Good")),
            time(2, 9 * 60, 10 * 60, Some("Prof Low")),
        ])));
    }

    #[test]
    fn compressed_schedule_allows_one_short_gap_per_day_only() {
        let data = data_with_credits(&[]);
        let constraints = Constraints {
            max_end: 24 * 60,
            compressed: true,
            ..Default::default()
        };

        let one_short_gap = vec![
            enrollment("CSI 1100", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("CSI 1101", vec![time(0, 11 * 60, 12 * 60, None)]),
        ];
        assert!(constraints.allows_final(&one_short_gap, &data));

        let long_gap = vec![
            enrollment("CSI 1100", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("CSI 1101", vec![time(0, 12 * 60, 13 * 60, None)]),
        ];
        assert!(!constraints.allows_final(&long_gap, &data));

        let two_gaps = vec![
            enrollment("CSI 1100", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("CSI 1101", vec![time(0, 10 * 60 + 30, 11 * 60, None)]),
            enrollment("CSI 1102", vec![time(0, 11 * 60 + 30, 12 * 60, None)]),
        ];
        assert!(!constraints.allows_final(&two_gaps, &data));
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
}
