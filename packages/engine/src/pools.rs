//! Requirement-pool math, ported from `poolHelpers.ts` and the elective helpers,
//! plus the group-token utilities from `utils/groupToken.ts`.

use std::collections::BTreeMap;

use crate::model::course_level;

pub const DEFAULT_CREDITS_PER_COURSE: f64 = 3.0;

pub fn normalize_course_credits(value: f64) -> f64 {
    if value.is_finite() && value > 0.0 {
        value
    } else {
        DEFAULT_CREDITS_PER_COURSE
    }
}

/// Synthesized requirement id for the "additional electives" pool (the `M`
/// free electives generated *on top* of the `courses_this_semester` target).
/// Its budget is reserved separately so structured requirement pools can never
/// starve it. Recognized by `advanced.rs` during allocation.
pub const ADDITIONAL_ELECTIVES_ID: &str = "__additional_electives__";

/// Synthesized requirement id for the cart pool used when the user's cart
/// exceeds the `courses_this_semester` cap (`N < cart`): the cart courses
/// become a highest-priority capped candidate pool instead of hard pins, so the
/// engine selects a conflict-feasible `N`-subset.
pub const CART_POOL_ID: &str = "__cart__";
pub const LEVEL_WEIGHT_BASE: f64 = 2.0;
const NON_COURSE_PREREQ_PENALTY: f64 = 0.3;
const UNKNOWN_LEVEL_FLOOR: f64 = 0.01;
const UNKNOWN_COURSE_LEVEL: i64 = 999_000;
const MAX_ELECTIVE_LEVEL: i64 = 4000;

#[derive(Clone)]
pub struct RequirementPool {
    pub requirement_id: String,
    pub req_type: String,
    pub label: String,
    pub candidate_courses: Vec<String>,
    pub credits_needed: f64,
    pub min_courses: usize,
}

pub struct RemainingRequirement {
    pub requirement_id: String,
    pub req_type: String,
    pub title: Option<String>,
    pub candidate_courses: Vec<String>,
    pub credits_needed: f64,
}

pub fn build_requirement_pools(remaining: &[RemainingRequirement]) -> Vec<RequirementPool> {
    let mut pools = Vec::new();
    for req in remaining {
        if req.requirement_id.is_empty() || req.candidate_courses.is_empty() {
            continue;
        }
        if req.credits_needed <= 0.0 {
            continue;
        }
        let mut unique: Vec<String> = Vec::new();
        for c in &req.candidate_courses {
            if !unique.contains(c) {
                unique.push(c.clone());
            }
        }
        if unique.is_empty() {
            continue;
        }
        let label = req
            .title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| {
                if req.req_type.is_empty() {
                    "Requirement".to_string()
                } else {
                    req.req_type.clone()
                }
            });
        let min_courses = if req.req_type == "course" || req.req_type == "or_course" {
            1
        } else {
            0
        };
        pools.push(RequirementPool {
            requirement_id: req.requirement_id.clone(),
            req_type: req.req_type.clone(),
            label,
            candidate_courses: unique,
            credits_needed: req.credits_needed,
            min_courses,
        });
    }
    pools
}

pub fn is_broad_elective_pool_type(t: &str) -> bool {
    matches!(
        t,
        "elective" | "free_elective" | "non_discipline_elective" | "faculty_elective"
    )
}

pub fn is_elective_requirement_type(t: &str) -> bool {
    matches!(
        t,
        "discipline_elective"
            | "elective"
            | "faculty_elective"
            | "free_elective"
            | "non_discipline_elective"
    )
}

pub fn is_within_elective_level_cap(code: &str) -> bool {
    match course_level(code) {
        None => true,
        Some(l) => l <= MAX_ELECTIVE_LEVEL,
    }
}

pub fn is_within_elective_level_buckets(code: &str, buckets: &[u32]) -> bool {
    if buckets.is_empty() {
        return is_within_elective_level_cap(code);
    }
    match course_level(code) {
        None => true,
        Some(l) => {
            let bucket = ((l / 1000) * 1000) as u32;
            buckets.contains(&bucket)
        }
    }
}

pub fn virtual_schedule_filter_applies(
    virtual_sections_only: bool,
    req_type: Option<&str>,
    norm_code: &str,
    explicit_exempt: &[String],
) -> bool {
    if !virtual_sections_only {
        return false;
    }
    match req_type {
        Some(t) if is_broad_elective_pool_type(t) => {}
        _ => return false,
    }
    !explicit_exempt.iter().any(|c| c == norm_code)
}

pub fn pool_course_cap(pool: &RequirementPool, credits_per_course: f64) -> usize {
    let credits_per_course = normalize_course_credits(credits_per_course);
    let raw = pool
        .min_courses
        .max((pool.credits_needed / credits_per_course).ceil() as usize);
    if pool.req_type == "discipline_elective" {
        raw.min(1)
    } else {
        raw
    }
}

pub fn build_pool_caps(
    pools: &[RequirementPool],
    credits_per_course: f64,
) -> BTreeMap<String, usize> {
    let mut cap = BTreeMap::new();
    for pool in pools {
        cap.insert(
            pool.requirement_id.clone(),
            pool_course_cap(pool, credits_per_course),
        );
    }
    cap
}

fn alloc_key(m: &BTreeMap<String, usize>) -> String {
    use std::fmt::Write;
    let mut key = String::new();
    for (id, n) in m {
        if !key.is_empty() {
            key.push('|');
        }
        let _ = write!(key, "{id}:{n}");
    }
    key
}

pub fn enumerate_single_redistributions(
    courses_per_pool: &BTreeMap<String, usize>,
    pools: &[RequirementPool],
    cap: &BTreeMap<String, usize>,
) -> Vec<BTreeMap<String, usize>> {
    let structured: Vec<&RequirementPool> = pools
        .iter()
        .filter(|p| !is_broad_elective_pool_type(&p.req_type))
        .collect();
    let broad: Vec<&RequirementPool> = pools
        .iter()
        .filter(|p| is_broad_elective_pool_type(&p.req_type))
        .collect();
    let mut out = Vec::new();
    let mut seen: Vec<String> = Vec::new();

    for s in &structured {
        let sn = *courses_per_pool.get(&s.requirement_id).unwrap_or(&0);
        if sn == 0 {
            continue;
        }
        for b in &broad {
            let bn = *courses_per_pool.get(&b.requirement_id).unwrap_or(&0);
            let bc = *cap.get(&b.requirement_id).unwrap_or(&0);
            if bn >= bc {
                continue;
            }
            let mut m = courses_per_pool.clone();
            m.insert(s.requirement_id.clone(), sn - 1);
            m.insert(b.requirement_id.clone(), bn + 1);
            let key = alloc_key(&m);
            if seen.contains(&key) {
                continue;
            }
            seen.push(key);
            out.push(m);
        }
    }
    out
}

fn greedy_place_one(
    pool_subset: &[&RequirementPool],
    result: &mut BTreeMap<String, usize>,
    cap: &BTreeMap<String, usize>,
) -> bool {
    let mut best: Option<(usize, f64, String, usize)> = None; // (room, credits, id, cur)
    for p in pool_subset {
        let cur = *result.get(&p.requirement_id).unwrap_or(&0);
        let max_c = *cap.get(&p.requirement_id).unwrap_or(&0);
        if max_c <= cur {
            continue;
        }
        let room = max_c - cur;
        let cand = (room, p.credits_needed, p.requirement_id.clone(), cur);
        best = match best {
            None => Some(cand),
            Some(ref b) => {
                if room != b.0 {
                    if room > b.0 {
                        Some(cand)
                    } else {
                        best
                    }
                } else if p.credits_needed > b.1 {
                    Some(cand)
                } else {
                    best
                }
            }
        };
    }
    match best {
        Some((_, _, id, cur)) => {
            result.insert(id, cur + 1);
            true
        }
        None => false,
    }
}

pub fn compute_courses_per_pool(
    pools: &[RequirementPool],
    remaining_slots: usize,
    credits_per_course: f64,
) -> BTreeMap<String, usize> {
    let mut result: BTreeMap<String, usize> = BTreeMap::new();
    if remaining_slots == 0 || pools.is_empty() {
        return result;
    }

    let mut cap: BTreeMap<String, usize> = BTreeMap::new();
    let mut sum_cap = 0usize;
    for pool in pools {
        let c = pool_course_cap(pool, credits_per_course);
        cap.insert(pool.requirement_id.clone(), c);
        sum_cap += c;
        result.insert(pool.requirement_id.clone(), 0);
    }
    if sum_cap == 0 {
        return BTreeMap::new();
    }

    let target = remaining_slots.min(sum_cap);
    let structured: Vec<&RequirementPool> = pools
        .iter()
        .filter(|p| !is_broad_elective_pool_type(&p.req_type))
        .collect();
    let broad: Vec<&RequirementPool> = pools
        .iter()
        .filter(|p| is_broad_elective_pool_type(&p.req_type))
        .collect();

    let mut placed = 0usize;
    let sum_cap_structured: usize = structured
        .iter()
        .map(|p| *cap.get(&p.requirement_id).unwrap_or(&0))
        .sum();
    let target_structured = target.min(sum_cap_structured);
    while placed < target_structured {
        if !greedy_place_one(&structured, &mut result, &cap) {
            break;
        }
        placed += 1;
    }
    while placed < target {
        if !greedy_place_one(&broad, &mut result, &cap) {
            break;
        }
        placed += 1;
    }

    if placed < remaining_slots && !broad.is_empty() && !structured.is_empty() {
        let mut overflow_cap = cap.clone();
        for p in &broad {
            overflow_cap.insert(p.requirement_id.clone(), remaining_slots);
        }
        while placed < remaining_slots {
            if !greedy_place_one(&broad, &mut result, &overflow_cap) {
                break;
            }
            placed += 1;
        }
    }

    result
}

pub fn candidate_pool_weight(level: i64, has_non_course_prereq: bool) -> f64 {
    if level >= UNKNOWN_COURSE_LEVEL {
        return UNKNOWN_LEVEL_FLOOR;
    }
    let tier = (level / 1000).max(1);
    let mut w = 1.0 / LEVEL_WEIGHT_BASE.powi((tier - 1) as i32);
    if has_non_course_prereq {
        w *= NON_COURSE_PREREQ_PENALTY;
    }
    w
}

// --- Group tokens ---

const GROUP: &str = "group:";

pub fn is_group_token(s: &str) -> bool {
    s.starts_with(GROUP)
}

pub fn group_token_prefix(s: &str) -> String {
    let rest = &s[GROUP.len().min(s.len())..];
    let raw = match rest.find('~') {
        Some(i) => &rest[..i],
        None => rest,
    };
    raw.to_ascii_uppercase()
}

pub fn canonical_group_token(s: &str) -> String {
    format!("{GROUP}{}", group_token_prefix(s))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pool(id: &str, req_type: &str, credits_needed: f64, min_courses: usize) -> RequirementPool {
        RequirementPool {
            requirement_id: id.to_string(),
            req_type: req_type.to_string(),
            label: id.to_string(),
            candidate_courses: vec![format!("{id} 1000")],
            credits_needed,
            min_courses,
        }
    }

    #[test]
    fn requirement_pools_skip_empty_requirements_and_dedupe_candidates() {
        let pools = build_requirement_pools(&[
            RemainingRequirement {
                requirement_id: "core".to_string(),
                req_type: "course".to_string(),
                title: Some("Core requirement".to_string()),
                candidate_courses: vec!["CSI 1100".to_string(), "CSI 1100".to_string()],
                credits_needed: 3.0,
            },
            RemainingRequirement {
                requirement_id: "empty".to_string(),
                req_type: "course".to_string(),
                title: None,
                candidate_courses: Vec::new(),
                credits_needed: 3.0,
            },
            RemainingRequirement {
                requirement_id: "complete".to_string(),
                req_type: "course".to_string(),
                title: None,
                candidate_courses: vec!["CSI 2100".to_string()],
                credits_needed: 0.0,
            },
        ]);

        assert_eq!(pools.len(), 1);
        assert_eq!(pools[0].label, "Core requirement");
        assert_eq!(pools[0].candidate_courses, vec!["CSI 1100"]);
        assert_eq!(pools[0].min_courses, 1);
    }

    #[test]
    fn courses_per_pool_prioritizes_structured_requirements_then_broad_electives() {
        let pools = vec![
            pool("core", "core", 6.0, 0),
            pool("discipline", "discipline_elective", 9.0, 0),
            pool("free", "free_elective", 3.0, 0),
        ];

        let allocation = compute_courses_per_pool(&pools, 4, DEFAULT_CREDITS_PER_COURSE);

        assert_eq!(allocation.get("core"), Some(&2));
        assert_eq!(allocation.get("discipline"), Some(&1));
        assert_eq!(allocation.get("free"), Some(&1));
    }

    #[test]
    fn pool_course_cap_uses_school_typical_course_credits() {
        assert_eq!(
            pool_course_cap(&pool("carleton", "elective", 3.0, 0), 0.5),
            6
        );
        assert_eq!(
            pool_course_cap(&pool("uottawa", "elective", 3.0, 0), 3.0),
            1
        );
    }

    #[test]
    fn pool_caps_and_allocation_use_school_typical_course_credits() {
        let pools = vec![
            pool("core", "course", 0.5, 1),
            pool("comp", "elective", 3.0, 0),
        ];

        let caps = build_pool_caps(&pools, 0.5);
        let allocation = compute_courses_per_pool(&pools, 7, 0.5);

        assert_eq!(caps.get("core"), Some(&1));
        assert_eq!(caps.get("comp"), Some(&6));
        assert_eq!(allocation.get("core"), Some(&1));
        assert_eq!(allocation.get("comp"), Some(&6));
    }

    #[test]
    fn broad_elective_can_overflow_when_structured_caps_cannot_fill_semester() {
        let pools = vec![
            pool("core", "course", 3.0, 1),
            pool("free", "free_elective", 3.0, 0),
        ];

        let allocation = compute_courses_per_pool(&pools, 3, DEFAULT_CREDITS_PER_COURSE);

        assert_eq!(allocation.get("core"), Some(&1));
        assert_eq!(allocation.get("free"), Some(&2));
    }

    #[test]
    fn redistributions_move_one_slot_from_structured_to_broad_with_remaining_cap() {
        let pools = vec![
            pool("core", "core", 6.0, 0),
            pool("free", "free_elective", 3.0, 0),
        ];
        let current = BTreeMap::from([("core".to_string(), 2), ("free".to_string(), 0)]);
        let caps = BTreeMap::from([("core".to_string(), 2), ("free".to_string(), 1)]);

        let alternatives = enumerate_single_redistributions(&current, &pools, &caps);

        assert_eq!(alternatives.len(), 1);
        assert_eq!(alternatives[0].get("core"), Some(&1));
        assert_eq!(alternatives[0].get("free"), Some(&1));
    }

    #[test]
    fn elective_level_filters_apply_bucket_restrictions_and_global_cap() {
        assert!(is_within_elective_level_buckets("CSI 1100", &[1000, 2000]));
        assert!(!is_within_elective_level_buckets("CSI 3100", &[1000, 2000]));
        assert!(is_within_elective_level_buckets("UNPARSEABLE", &[1000]));

        assert!(is_within_elective_level_cap("CSI 4100"));
        assert!(!is_within_elective_level_cap("CSI 5100"));
    }

    #[test]
    fn candidate_pool_weight_prefers_lower_level_and_penalizes_hard_prerequisites() {
        let first_year = candidate_pool_weight(1000, false);
        let second_year = candidate_pool_weight(2000, false);
        let hard_prereq = candidate_pool_weight(1000, true);
        let unknown = candidate_pool_weight(999_000, false);

        assert!(first_year > second_year);
        assert!(hard_prereq < first_year);
        assert!(unknown < hard_prereq);
    }

    #[test]
    fn group_tokens_canonicalize_prefixes_independent_of_variant_suffixes() {
        assert!(is_group_token("group:csi~1"));
        assert_eq!(group_token_prefix("group:csi~1"), "CSI");
        assert_eq!(canonical_group_token("group:csi~1"), "group:CSI");
    }
}
