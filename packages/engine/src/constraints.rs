//! Hard-constraint checks, ported from `generation/constraints.ts` and
//! `engine/constraints/builtins.ts`. The active constraint set while timetabling
//! a fixed course set is: time-window (section), min-professor-rating (section),
//! overlap (incremental), compressed-schedule (final) and the first-year credit
//! cap (final). The blacklist is applied during *selection*, not here.

use std::collections::HashMap;

use crate::model::{first_four_digit_number, DataView};
use crate::types::{RtSection, RtTime};

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
    pub fn allows_final(&self, codes_times: &[(String, Vec<RtTime>)], data: &DataView) -> bool {
        if self.compressed && !satisfies_compressed(codes_times) {
            return false;
        }
        if let Some(cap) = self.max_first_year_credits {
            let mut total = 0.0;
            for (code, _) in codes_times {
                total += first_year_credits(code, data.get_course(code).map(|c| c.credits));
                if total > cap {
                    return false;
                }
            }
        }
        true
    }
}

pub fn normalize_professor_name(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn first_year_credits(code: &str, credits: Option<f64>) -> f64 {
    match first_four_digit_number(code) {
        Some(n) if n < 2000 => credits.unwrap_or(3.0),
        _ => 0.0,
    }
}

fn satisfies_compressed(codes_times: &[(String, Vec<RtTime>)]) -> bool {
    let mut by_day: HashMap<u8, Vec<(u32, u32)>> = HashMap::new();
    for (_, times) in codes_times {
        for t in times {
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
