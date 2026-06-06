//! Requirement-pool math, ported from `poolHelpers.ts` and the elective helpers,
//! plus the group-token utilities from `utils/groupToken.ts`.

use std::collections::BTreeMap;

use crate::model::course_level;

pub const DEFAULT_CREDITS_PER_COURSE: f64 = 3.0;
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
    #[allow(dead_code)]
    pub satisfied_by: Vec<String>,
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

pub fn pool_course_cap(pool: &RequirementPool) -> usize {
    let raw = pool
        .min_courses
        .max((pool.credits_needed / DEFAULT_CREDITS_PER_COURSE).ceil() as usize);
    if pool.req_type == "discipline_elective" {
        raw.min(1)
    } else {
        raw
    }
}

pub fn build_pool_caps(pools: &[RequirementPool]) -> BTreeMap<String, usize> {
    let mut cap = BTreeMap::new();
    for pool in pools {
        cap.insert(pool.requirement_id.clone(), pool_course_cap(pool));
    }
    cap
}

fn alloc_key(m: &BTreeMap<String, usize>) -> String {
    m.iter()
        .map(|(id, n)| format!("{id}:{n}"))
        .collect::<Vec<_>>()
        .join("|")
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
) -> BTreeMap<String, usize> {
    let mut result: BTreeMap<String, usize> = BTreeMap::new();
    if remaining_slots == 0 || pools.is_empty() {
        return result;
    }

    let mut cap: BTreeMap<String, usize> = BTreeMap::new();
    let mut sum_cap = 0usize;
    for pool in pools {
        let c = pool_course_cap(pool);
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
