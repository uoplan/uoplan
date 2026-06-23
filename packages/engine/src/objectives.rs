//! Optimization objectives: per-objective scoring of a *complete* schedule plus a
//! quantized-lexicographic comparator that ranks two schedules by the user's
//! ordered, individually-enabled priority list. Mirrors the shared TS model
//! (`@uoplan/core` optimizationPriorities.ts) and the `engine.proto`
//! `OptimizationPriority` list.
//!
//! Two roles:
//!   * **Selection biases** (`prefer_easier` / `prefer_sentiment` /
//!     `prefer_professor_rating`) stay as the existing multiplicative selection
//!     weights so good candidates actually enter the pool — gated by their
//!     `enabled` flag here (single source of truth).
//!   * **Timetable-shape objectives** (`free_days` / `good_breaks`) are scored
//!     over the final arrangement and engaged via best-of-K: when any is active
//!     the engine produces K arrangements per seed and keeps the one that wins the
//!     comparator. When only selection biases are active, K = 1 and behaviour/perf
//!     match the previous single pass. (A legacy `compact` priority is folded into
//!     `good_breaks` targeting zero gaps.)

use std::collections::HashMap;

use crate::constraints::normalize_professor_name;
use crate::proto::engine::{OptimizationKind, OptimizationPriority as ProtoPriority};
use crate::types::Enrollment;

/// Near-tie tolerance for the quantized-lexicographic comparator: two objective
/// scores within this band are treated as equal, deferring the decision to the
/// next (lower-priority) objective. Keeps float noise in one objective from
/// dominating the entire ranking. Tunable.
const SCORE_TOLERANCE: f64 = 0.02;

/// Candidate arrangements generated per seed when a timetable-shape objective is
/// active (best-of-K). 1 when only selection biases are enabled. Higher K gives
/// the comparator more diverse arrangements to choose from, so shape objectives
/// (esp. "good breaks") land closer to the request.
pub const BEST_OF_K: u32 = 32;

/// Mon..Fri — free-day scoring ignores the weekend.
const WEEKDAYS: u8 = 5;
/// A gap shorter than this (minutes) is "back-to-back", not a break.
const MIN_BREAK_MINUTES: u32 = 10;
/// Multiplicative penalty applied per break OVER the requested count — steep,
/// because "too many gaps" is the thing users complain about.
const BREAK_EXCESS_DECAY: f64 = 0.35;
/// Linear penalty applied per break UNDER the requested count — gentle, because a
/// compact / back-to-back day is rarely unwanted.
const BREAK_DEFICIT_STEP: f64 = 0.2;
const PROFESSOR_RATING_UNRATED: f64 = 4.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    FreeDays,
    GoodBreaks,
    PreferEasier,
    PreferSentiment,
    PreferProfessorRating,
}

impl Kind {
    fn from_proto(value: i32) -> Option<Kind> {
        match OptimizationKind::try_from(value).ok()? {
            OptimizationKind::FreeDays => Some(Kind::FreeDays),
            // `compact` is folded into `good_breaks` targeting zero gaps — a
            // strictly more flexible superset (minimize idle == "good breaks" with
            // a break count of 0). The proto enum value is retained for wire
            // compatibility with persisted state; `from_request` forces its break
            // count to 0.
            OptimizationKind::GoodBreaks | OptimizationKind::Compact => Some(Kind::GoodBreaks),
            OptimizationKind::PreferEasier => Some(Kind::PreferEasier),
            OptimizationKind::PreferSentiment => Some(Kind::PreferSentiment),
            OptimizationKind::PreferProfessorRating => Some(Kind::PreferProfessorRating),
            OptimizationKind::Unspecified => None,
        }
    }

    fn is_shape(self) -> bool {
        matches!(self, Kind::FreeDays | Kind::GoodBreaks)
    }
}

#[derive(Clone, Copy)]
struct Objective {
    kind: Kind,
    break_count: u32,
    break_target_minutes: u32,
}

/// The parsed, ordered, enabled objective list plus the data maps each scorer
/// needs. Built once per generation from the request.
pub struct Objectives<'a> {
    active: Vec<Objective>,
    professor_ratings: &'a HashMap<String, f64>,
    course_aplus: &'a HashMap<String, f64>,
    course_sentiment: &'a HashMap<String, f64>,
}

impl<'a> Objectives<'a> {
    pub fn from_request(
        priorities: &[ProtoPriority],
        professor_ratings: &'a HashMap<String, f64>,
        course_aplus: &'a HashMap<String, f64>,
        course_sentiment: &'a HashMap<String, f64>,
    ) -> Objectives<'a> {
        let mut active = Vec::new();
        for p in priorities {
            if !p.enabled {
                continue;
            }
            let Some(kind) = Kind::from_proto(p.kind) else {
                continue;
            };
            if active.iter().any(|o: &Objective| o.kind == kind) {
                continue;
            }
            // A folded `compact` priority (now a `good_breaks` kind) targets zero
            // gaps; ignore any stray break params carried on the legacy entry.
            let is_compact = p.kind == OptimizationKind::Compact as i32;
            active.push(Objective {
                kind,
                break_count: if is_compact { 0 } else { p.break_count },
                break_target_minutes: p.break_target_minutes.max(1),
            });
        }
        Objectives {
            active,
            professor_ratings,
            course_aplus,
            course_sentiment,
        }
    }

    fn has(&self, kind: Kind) -> bool {
        self.active.iter().any(|o| o.kind == kind)
    }

    pub fn prefer_easier(&self) -> bool {
        self.has(Kind::PreferEasier)
    }

    pub fn prefer_sentiment(&self) -> bool {
        self.has(Kind::PreferSentiment)
    }

    pub fn prefer_professor_rating(&self) -> bool {
        self.has(Kind::PreferProfessorRating)
    }

    /// Whether a timetable-shape objective is active (→ engage best-of-K).
    pub fn needs_best_of_k(&self) -> bool {
        self.active.iter().any(|o| o.kind.is_shape())
    }

    pub fn candidate_count(&self) -> u32 {
        if self.needs_best_of_k() {
            BEST_OF_K
        } else {
            1
        }
    }

    /// Score a complete schedule against each active objective, in priority
    /// order. Each score is in `[0, 1]` (higher = better).
    pub fn score(&self, chosen: &[Enrollment]) -> Vec<f64> {
        self.active
            .iter()
            .map(|o| match o.kind {
                Kind::FreeDays => free_days_score(chosen),
                Kind::GoodBreaks => {
                    good_breaks_score(chosen, o.break_count, o.break_target_minutes)
                }
                Kind::PreferEasier => prefer_map_score(chosen, self.course_aplus, 100.0),
                Kind::PreferSentiment => prefer_map_score(chosen, self.course_sentiment, 5.0),
                Kind::PreferProfessorRating => {
                    prefer_professor_score(chosen, self.professor_ratings)
                }
            })
            .collect()
    }

    /// Quantized-lexicographic comparison: returns `true` when `a` is *strictly
    /// better* than `b`. Objectives are compared in priority order; scores within
    /// [`SCORE_TOLERANCE`] are treated as a tie and the decision defers to the
    /// next objective. Equal-within-tolerance across all objectives ⇒ `false`
    /// (the incumbent / earlier candidate is kept).
    pub fn better(&self, a: &[f64], b: &[f64]) -> bool {
        for (sa, sb) in a.iter().zip(b.iter()) {
            if (sa - sb).abs() <= SCORE_TOLERANCE {
                continue;
            }
            return sa > sb;
        }
        false
    }

    #[cfg(test)]
    pub fn active_kinds(&self) -> Vec<Kind> {
        self.active.iter().map(|o| o.kind).collect()
    }
}

/// Group every meeting time into per-weekday `(start, end)` lists (Mon..Sun),
/// sorted by start. This merges *all* weeks together, so it's only used where
/// week structure is irrelevant (free-day detection: a weekday is free only if
/// no class ever meets on it).
fn classes_by_day(chosen: &[Enrollment]) -> [Vec<(u32, u32)>; 7] {
    let mut by_day: [Vec<(u32, u32)>; 7] = Default::default();
    for e in chosen {
        for t in &e.times {
            if t.start < t.end {
                by_day[usize::from(t.day.min(6))].push((t.start, t.end));
            }
        }
    }
    for day in &mut by_day {
        day.sort_by_key(|&(s, _)| s);
    }
    by_day
}

/// Convert a `yyyymmdd` date to a day ordinal (days since 1970-01-01) via the
/// Howard Hinnant days-from-civil algorithm. Used to measure term-segment length
/// in weeks and to test date-range membership. Returns `None` for invalid input
/// (e.g. the `0` sentinel or an out-of-range month/day).
fn ymd_to_ordinal(ymd: u32) -> Option<i64> {
    if ymd == 0 {
        return None;
    }
    let y = i64::from(ymd / 10000);
    let m = i64::from((ymd / 100) % 100);
    let d = i64::from(ymd % 100);
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let y = y - i64::from(m <= 2);
    let era = (if y >= 0 { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

/// A term "segment": a maximal date window over which the set of active meeting
/// times is constant, its per-weekday `(start, end)` layout, and a `weight`
/// proportional to the number of weeks the window spans (so longer phases count
/// more when averaging week-aware objectives).
struct DaySegment {
    weight: f64,
    by_day: [Vec<(u32, u32)>; 7],
}

/// Partition the term into segments where the active classes are constant and
/// build each segment's per-weekday layout. A class with an explicit `dates`
/// range (partial-term offerings) only appears in the segments its range covers,
/// so two classes that never share a real week can't produce a phantom gap
/// between them. When no class carries a usable date range (the common case —
/// everything meets every week) this returns a single full-term segment whose
/// layout matches the merged [`classes_by_day`].
fn day_segments(chosen: &[Enrollment]) -> Vec<DaySegment> {
    // (weekday, start, end, optional ordinal date range) for every real meeting.
    let mut times: Vec<(usize, u32, u32, Option<(i64, i64)>)> = Vec::new();
    let mut any_range = false;
    for e in chosen {
        for t in &e.times {
            if t.start >= t.end {
                continue;
            }
            let range = match t.dates {
                Some((s, e2)) => match (ymd_to_ordinal(s), ymd_to_ordinal(e2)) {
                    (Some(so), Some(eo)) if so <= eo => {
                        any_range = true;
                        Some((so, eo))
                    }
                    _ => None,
                },
                None => None,
            };
            times.push((usize::from(t.day.min(6)), t.start, t.end, range));
        }
    }

    // Fast path: no usable date ranges ⇒ one full-term segment (merged layout).
    if !any_range {
        return vec![DaySegment {
            weight: 1.0,
            by_day: classes_by_day(chosen),
        }];
    }

    // Term span from the dated times; undated times are active throughout.
    let mut gmin = i64::MAX;
    let mut gmax = i64::MIN;
    for &(_, _, _, range) in &times {
        if let Some((so, eo)) = range {
            gmin = gmin.min(so);
            gmax = gmax.max(eo);
        }
    }
    // Segment boundaries: every range start and (end + 1), within the term span.
    let mut bounds: std::collections::BTreeSet<i64> = std::collections::BTreeSet::new();
    bounds.insert(gmin);
    bounds.insert(gmax + 1);
    for &(_, _, _, range) in &times {
        if let Some((so, eo)) = range {
            if (gmin..=gmax).contains(&so) {
                bounds.insert(so);
            }
            if (gmin..=gmax + 1).contains(&(eo + 1)) {
                bounds.insert(eo + 1);
            }
        }
    }
    let bounds: Vec<i64> = bounds.into_iter().collect();

    let mut segments = Vec::new();
    for w in bounds.windows(2) {
        let (seg_start, seg_end) = (w[0], w[1] - 1);
        if seg_end < seg_start {
            continue;
        }
        let mut by_day: [Vec<(u32, u32)>; 7] = Default::default();
        for &(day, start, end, range) in &times {
            let active = match range {
                Some((so, eo)) => so <= seg_end && eo >= seg_start,
                None => true,
            };
            if active {
                by_day[day].push((start, end));
            }
        }
        for d in &mut by_day {
            d.sort_by_key(|&(s, _)| s);
        }
        // Weight ≈ number of weeks in the window (≥ 1).
        let weeks = ((seg_end - seg_start + 1) as f64 / 7.0).max(1.0);
        segments.push(DaySegment {
            weight: weeks,
            by_day,
        });
    }
    segments
}

/// Fraction of weekdays (Mon..Fri) with no classes.
fn free_days_score(chosen: &[Enrollment]) -> f64 {
    let by_day = classes_by_day(chosen);
    let mut free = 0u32;
    for day in 0..WEEKDAYS as usize {
        if by_day[day].is_empty() {
            free += 1;
        }
    }
    f64::from(free) / f64::from(WEEKDAYS)
}

/// Positive mid-day gaps (minutes) between consecutive classes on one sorted day.
fn day_gaps(times: &[(u32, u32)]) -> Vec<u32> {
    let mut gaps = Vec::new();
    let mut cursor = times.first().map(|&(_, e)| e).unwrap_or(0);
    for &(start, end) in times.iter().skip(1) {
        if start > cursor {
            gaps.push(start - cursor);
        }
        cursor = cursor.max(end);
    }
    gaps
}

/// How closely a single class-day matches "~`target_count` breaks of ~`target_min`
/// minutes" (0..1). Breaks OVER the target are penalized steeply (the common
/// complaint — too many gaps); having FEWER than asked is penalized gently (a
/// back-to-back day is rarely unwanted). `target_count` of 0 means "no breaks"
/// and rewards fully back-to-back days. `target_min` is pre-clamped to ≥ 1.
fn per_day_break_score(times: &[(u32, u32)], target_count: u32, target_min: f64) -> f64 {
    let breaks: Vec<u32> = day_gaps(times)
        .into_iter()
        .filter(|&g| g >= MIN_BREAK_MINUTES)
        .collect();
    let n = breaks.len() as i64;
    let target = i64::from(target_count);
    // Count component: 1.0 at exactly `target`; steep decay above, gentle below.
    let count_score = if n >= target {
        BREAK_EXCESS_DECAY.powi((n - target) as i32)
    } else {
        (1.0 - BREAK_DEFICIT_STEP * (target - n) as f64).max(0.0)
    };
    if breaks.is_empty() {
        // No breaks at all: either exactly what was asked (target 0 ⇒ 1.0) or a
        // deficit already captured by `count_score`. Length is irrelevant.
        return count_score;
    }
    // Length component: mean closeness of each break to the target length.
    let length_score = breaks
        .iter()
        .map(|&g| (-(f64::from(g) - target_min).abs() / target_min).exp())
        .sum::<f64>()
        / breaks.len() as f64;
    // Length multiplies the count score with no floor: a break wildly off the
    // requested length is not really a break (a ~12-hour "gap" between an 8:30 and
    // a 22:00 class is a wasted day, not a lunch break), so an otherwise-correct
    // count can still score ~0. This stops the comparator from preferring a single
    // absurd gap over two on-target breaks. Near the target the exp decay is gentle,
    // so a slightly-off break barely loses ground.
    count_score * length_score
}

/// How closely the schedule matches "~`target_count` breaks of ~`target_min`
/// minutes" on class-days. Evaluated **per term-segment** so partial-term classes
/// only contribute breaks in the weeks they actually meet (no phantom cross-week
/// gaps), then averaged over every (segment, weekday) that has ≥2 classes,
/// weighted by the segment's week span. 1.0 when no day has ≥2 classes.
fn good_breaks_score(chosen: &[Enrollment], target_count: u32, target_min: u32) -> f64 {
    let target_min = f64::from(target_min.max(1));
    let mut total = 0.0;
    let mut weight = 0.0;
    for seg in day_segments(chosen) {
        for day in 0..WEEKDAYS as usize {
            if seg.by_day[day].len() < 2 {
                continue;
            }
            total += seg.weight * per_day_break_score(&seg.by_day[day], target_count, target_min);
            weight += seg.weight;
        }
    }
    if weight == 0.0 {
        1.0
    } else {
        total / weight
    }
}

/// Mean of `map[course] / scale` over chosen courses present in the map. Neutral
/// 0.5 when none are present (so the objective neither helps nor hurts ties).
fn prefer_map_score(chosen: &[Enrollment], map: &HashMap<String, f64>, scale: f64) -> f64 {
    let mut sum = 0.0;
    let mut count = 0u32;
    for e in chosen {
        if let Some(&v) = map.get(&e.course_code) {
            sum += (v / scale).clamp(0.0, 1.0);
            count += 1;
        }
    }
    if count == 0 {
        0.5
    } else {
        sum / f64::from(count)
    }
}

/// Mean professor rating across the schedule's distinct instructors (unrated ⇒
/// [`PROFESSOR_RATING_UNRATED`]), normalized to `[0, 1]` by /5. Neutral 0.5 when
/// no instructors are present.
fn prefer_professor_score(chosen: &[Enrollment], ratings: &HashMap<String, f64>) -> f64 {
    let mut seen: Vec<String> = Vec::new();
    let mut sum = 0.0;
    let mut count = 0u32;
    for e in chosen {
        for t in &e.times {
            if let Some(name) = &t.instructor {
                let key = normalize_professor_name(name);
                if key.is_empty() || seen.contains(&key) {
                    continue;
                }
                let rating = match ratings.get(&key) {
                    Some(&r) if r.is_finite() => r,
                    _ => PROFESSOR_RATING_UNRATED,
                };
                seen.push(key);
                sum += rating;
                count += 1;
            }
        }
    }
    if count == 0 {
        0.5
    } else {
        (sum / f64::from(count) / 5.0).clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::types::{RtTime, WeekMask};

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

    fn dated(day: u8, start: u32, end: u32, dates: (u32, u32)) -> RtTime {
        RtTime {
            day,
            start,
            end,
            is_virtual: false,
            instructor: None,
            dates: Some(dates),
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

    fn proto(kind: OptimizationKind, enabled: bool) -> ProtoPriority {
        ProtoPriority {
            kind: kind as i32,
            enabled,
            break_count: 1,
            break_target_minutes: 60,
        }
    }

    fn empty_maps() -> (
        HashMap<String, f64>,
        HashMap<String, f64>,
        HashMap<String, f64>,
    ) {
        (HashMap::new(), HashMap::new(), HashMap::new())
    }

    #[test]
    fn from_request_keeps_only_enabled_in_order_and_dedupes() {
        let (pr, ap, se) = empty_maps();
        let objs = Objectives::from_request(
            &[
                proto(OptimizationKind::Compact, true),
                proto(OptimizationKind::FreeDays, false),
                proto(OptimizationKind::PreferEasier, true),
                proto(OptimizationKind::Compact, true),
            ],
            &pr,
            &ap,
            &se,
        );
        // `compact` folds into `good_breaks`; the duplicate is deduped.
        assert_eq!(
            objs.active_kinds(),
            vec![Kind::GoodBreaks, Kind::PreferEasier]
        );
        assert!(objs.needs_best_of_k());
        assert!(objs.prefer_easier());
        assert!(!objs.prefer_sentiment());
    }

    #[test]
    fn no_shape_objective_means_single_candidate() {
        let (pr, ap, se) = empty_maps();
        let objs = Objectives::from_request(
            &[proto(OptimizationKind::PreferEasier, true)],
            &pr,
            &ap,
            &se,
        );
        assert!(!objs.needs_best_of_k());
        assert_eq!(objs.candidate_count(), 1);
    }

    #[test]
    fn free_days_counts_empty_weekdays() {
        let schedule = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(2, 9 * 60, 10 * 60, None)]),
        ];
        // Mon + Wed used → 3 of 5 weekdays free.
        assert!((free_days_score(&schedule) - 3.0 / 5.0).abs() < 1e-9);
    }

    #[test]
    fn good_breaks_zero_target_prefers_back_to_back() {
        // `compact` is now `good_breaks` with a break count of 0.
        let tight = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 10 * 60, 11 * 60, None)]),
        ];
        let gappy = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 14 * 60, 15 * 60, None)]),
        ];
        assert!(good_breaks_score(&tight, 0, 90) > good_breaks_score(&gappy, 0, 90));
        assert!((good_breaks_score(&tight, 0, 90) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn good_breaks_rewards_target_gap() {
        // One ~60-minute break matches target (count 1, 60 min).
        let on_target = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 11 * 60, 12 * 60, None)]),
        ];
        // Two scattered breaks — worse for target of a single ~60-min break.
        let off_target = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 13 * 60, 14 * 60, None)]),
            enrollment("C", vec![time(0, 16 * 60, 17 * 60, None)]),
        ];
        assert!(good_breaks_score(&on_target, 1, 60) > good_breaks_score(&off_target, 1, 60));
    }

    #[test]
    fn good_breaks_penalizes_extra_breaks_even_when_averaged() {
        // Two clean days (one ~60-min break each) must beat a schedule where one
        // day carries an extra break, even though the other day is identical and
        // the per-day scores get averaged across the week.
        let clean = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 11 * 60, 12 * 60, None)]),
            enrollment("C", vec![time(1, 9 * 60, 10 * 60, None)]),
            enrollment("D", vec![time(1, 11 * 60, 12 * 60, None)]),
        ];
        // Monday now has TWO breaks (9–10, 11–12, 13–14); Tuesday still has one.
        let messy = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 11 * 60, 12 * 60, None)]),
            enrollment("E", vec![time(0, 13 * 60, 14 * 60, None)]),
            enrollment("C", vec![time(1, 9 * 60, 10 * 60, None)]),
            enrollment("D", vec![time(1, 11 * 60, 12 * 60, None)]),
        ];
        let clean_score = good_breaks_score(&clean, 1, 60);
        let messy_score = good_breaks_score(&messy, 1, 60);
        assert!(
            clean_score > messy_score + SCORE_TOLERANCE,
            "clean {clean_score} should clearly beat messy {messy_score}"
        );
    }

    #[test]
    fn good_breaks_single_giant_gap_loses_to_two_on_target_breaks() {
        // User report: with "1 break of ~60 min", a day pairing an 8:30 class with
        // a 22:00 class (one ~12-hour "gap") was being preferred over arrangements
        // with proper breaks. The count matches the target (one gap), but a 12-hour
        // void is not a break — it must NOT outrank two on-target breaks.
        let giant = vec![
            enrollment("A", vec![time(0, 8 * 60 + 30, 9 * 60 + 50, None)]),
            enrollment("B", vec![time(0, 22 * 60, 23 * 60 + 20, None)]),
        ];
        let two_on_target = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 11 * 60, 12 * 60, None)]),
            enrollment("C", vec![time(0, 13 * 60, 14 * 60, None)]),
        ];
        let giant_score = good_breaks_score(&giant, 1, 60);
        let two_score = good_breaks_score(&two_on_target, 1, 60);
        assert!(
            two_score > giant_score,
            "two on-target breaks {two_score} should beat one 12h void {giant_score}"
        );
    }

    #[test]
    fn good_breaks_giant_gap_scores_near_zero() {
        // A single break wildly off the requested length contributes ~nothing, so
        // the schedule's break score reflects how unusable the "break" is.
        let giant = vec![
            enrollment("A", vec![time(0, 8 * 60 + 30, 9 * 60 + 50, None)]),
            enrollment("B", vec![time(0, 22 * 60, 23 * 60 + 20, None)]),
        ];
        assert!(
            good_breaks_score(&giant, 1, 60) < 0.2,
            "a ~12-hour void is not a 60-minute break"
        );
    }

    #[test]
    fn good_breaks_zero_target_rewards_back_to_back() {
        // Target 0 breaks ⇒ a fully back-to-back day is perfect; any gap is bad.
        let compact = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 10 * 60, 11 * 60, None)]),
        ];
        let gappy = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 11 * 60, 12 * 60, None)]),
        ];
        assert!((good_breaks_score(&compact, 0, 60) - 1.0).abs() < 1e-9);
        assert!(good_breaks_score(&compact, 0, 60) > good_breaks_score(&gappy, 0, 60));
    }

    #[test]
    fn good_breaks_from_request_preserves_zero_break_count() {
        let (pr, ap, se) = empty_maps();
        let mut p = proto(OptimizationKind::GoodBreaks, true);
        p.break_count = 0;
        p.break_target_minutes = 60;
        let objs = Objectives::from_request(&[p], &pr, &ap, &se);
        assert_eq!(objs.active[0].break_count, 0);
    }

    #[test]
    fn ymd_ordinal_counts_days() {
        let a = ymd_to_ordinal(20250101).unwrap();
        let b = ymd_to_ordinal(20250108).unwrap();
        assert_eq!(b - a, 7);
        assert_eq!(
            ymd_to_ordinal(20250301).unwrap() - ymd_to_ordinal(20250228).unwrap(),
            1
        );
        assert_eq!(ymd_to_ordinal(0), None);
    }

    #[test]
    fn good_breaks_ignores_phantom_cross_term_gap() {
        // First-half and second-half Monday classes never share a real week, so
        // the big midday gap between them must NOT be scored as a break.
        let split = vec![
            enrollment("A", vec![dated(0, 9 * 60, 10 * 60, (20250106, 20250214))]),
            enrollment("B", vec![dated(0, 14 * 60, 15 * 60, (20250217, 20250404))]),
        ];
        // The same two times meeting all term collapse into one phantom ~5h break.
        let merged = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 14 * 60, 15 * 60, None)]),
        ];
        assert!(good_breaks_score(&split, 1, 60) > good_breaks_score(&merged, 1, 60));
        // No weekday has ≥2 classes in any single week ⇒ neutral 1.0.
        assert!((good_breaks_score(&split, 1, 60) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn good_breaks_scores_real_break_within_a_partial_term() {
        // Both classes meet weeks 1–6 with a ~60-min midday gap ⇒ a real break.
        let on_target = vec![
            enrollment("A", vec![dated(0, 9 * 60, 10 * 60, (20250106, 20250214))]),
            enrollment("B", vec![dated(0, 11 * 60, 12 * 60, (20250106, 20250214))]),
        ];
        // A single far-apart break (360 min) is well off the 60-min target.
        let far = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 16 * 60, 17 * 60, None)]),
        ];
        assert!(good_breaks_score(&on_target, 1, 60) > good_breaks_score(&far, 1, 60));
    }

    #[test]
    fn good_breaks_zero_target_ignores_phantom_cross_term_gap() {
        let split = vec![
            enrollment("A", vec![dated(0, 9 * 60, 10 * 60, (20250106, 20250214))]),
            enrollment("B", vec![dated(0, 14 * 60, 15 * 60, (20250217, 20250404))]),
        ];
        let merged = vec![
            enrollment("A", vec![time(0, 9 * 60, 10 * 60, None)]),
            enrollment("B", vec![time(0, 14 * 60, 15 * 60, None)]),
        ];
        // The split term never has both classes in one week, so it's perfectly
        // back-to-back (1.0) for a zero-gap target.
        assert!(good_breaks_score(&split, 0, 90) > good_breaks_score(&merged, 0, 90));
        assert!((good_breaks_score(&split, 0, 90) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn comparator_is_quantized_lexicographic() {
        let (pr, ap, se) = empty_maps();
        let objs = Objectives::from_request(
            &[
                proto(OptimizationKind::FreeDays, true),
                proto(OptimizationKind::Compact, true),
            ],
            &pr,
            &ap,
            &se,
        );
        // Higher first objective wins outright.
        assert!(objs.better(&[0.8, 0.1], &[0.6, 0.9]));
        // First objective ties (within tolerance) → second decides.
        assert!(objs.better(&[0.80, 0.9], &[0.81, 0.4]));
        // All within tolerance → not strictly better.
        assert!(!objs.better(&[0.80, 0.50], &[0.81, 0.49]));
    }

    #[test]
    fn prefer_professor_normalizes_and_defaults_unrated() {
        let ratings = HashMap::from([("Great Prof".to_string(), 5.0)]);
        let rated = vec![enrollment(
            "A",
            vec![time(0, 9 * 60, 10 * 60, Some("Great Prof"))],
        )];
        let unrated = vec![enrollment(
            "A",
            vec![time(0, 9 * 60, 10 * 60, Some("Nobody"))],
        )];
        assert!((prefer_professor_score(&rated, &ratings) - 1.0).abs() < 1e-9);
        assert!(
            (prefer_professor_score(&unrated, &ratings) - PROFESSOR_RATING_UNRATED / 5.0).abs()
                < 1e-9
        );
    }
}
