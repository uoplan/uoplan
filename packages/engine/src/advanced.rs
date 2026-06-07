//! Advanced-mode generation, ported from `generateSchedule/advanced.ts`,
//! `generateSchedule/helpers.ts` and `implicitHonours.ts`.
//!
//! French-immersion soft weighting is approximated as neutral (weight 1) under
//! the functional-parity contract; the prefer-easier soft weight uses the
//! A+ difficulty map supplied in the request.

use std::collections::{BTreeMap, HashMap, HashSet};

use crate::constraints::Constraints;
use crate::model::{
    course_matches_filters, course_level_sort_key, first_four_digit_number, normalize_course_code,
    subject_prefix, DataView, LanguageBucket, LevelBucket,
};
use crate::pools::{
    build_pool_caps, build_requirement_pools, candidate_pool_weight, canonical_group_token,
    compute_courses_per_pool, enumerate_single_redistributions, group_token_prefix,
    is_broad_elective_pool_type, is_elective_requirement_type, is_group_token,
    is_within_elective_level_cap, virtual_schedule_filter_applies, RemainingRequirement,
    RequirementPool,
};
use crate::prereq::prerequisites_contain_non_course;
use crate::rng::{scramble_seed, shuffle_in_place, weighted_random_pick_index, Rng};
use crate::timetable::{
    allows_enrollment, arrange_prebuilt_with_budget, build_timetable_course,
    first_seeded_arrangement, has_valid_section_combos, passes_final, FnResolver, TimetableCourse,
};
use crate::types::Enrollment;

const EASIER_APLUS_PIVOT: f64 = 20.0;
const EASIER_APLUS_BASE: f64 = 5.25;
const EASIER_APLUS_SCALE: f64 = 10.0;

/// Mirror of the TS RequirementWithStatus tree node.
#[derive(Clone)]
pub struct RequirementWithStatus {
    pub req_type: String,
    pub title: Option<String>,
    pub options: Vec<RequirementWithStatus>,
    pub complete: bool,
    pub satisfied_by: Vec<String>,
    pub requirement_id: Option<String>,
    pub candidate_courses: Vec<String>,
    pub credits_needed: Option<f64>,
}

pub struct AdvancedParams<'a> {
    pub data: &'a DataView,
    pub constraints: &'a Constraints,
    pub completed_courses: Vec<String>,
    pub prereq_eligible_courses: Vec<String>,
    pub remaining_requirements: Vec<RemainingRequirement>,
    pub requirement_tree: Vec<RequirementWithStatus>,
    pub constrained_per_requirement_raw: BTreeMap<String, Vec<String>>,
    pub selected_per_requirement: BTreeMap<String, Vec<String>>,
    pub selected_options_per_requirement: BTreeMap<String, u32>,
    pub courses_this_semester: usize,
    pub level_buckets: Vec<LevelBucket>,
    pub language_buckets: Vec<LanguageBucket>,
    pub elective_level_buckets: Vec<u32>,
    pub include_closed: bool,
    pub virtual_sections_only: bool,
    pub prefer_easier: bool,
    pub course_aplus: &'a HashMap<String, f64>,
    pub french_immersion_stream: bool,
    pub blacklisted_courses: Vec<String>,
    pub basic_excluded_categories: Vec<String>,
    pub forced_courses: Vec<String>,
    pub current_seed: u32,
    pub first_seed: u32,
}

pub struct EmptyPool {
    pub label: String,
    pub requirement_id: String,
    pub candidate_courses: Vec<String>,
}

pub struct PoolDiagnostics {
    pub empty_pools: Vec<EmptyPool>,
    pub total_available: usize,
    pub total_needed: usize,
}

pub struct AdvancedResult {
    pub schedule: Option<Vec<Enrollment>>,
    pub filtered_optional_pool: Vec<String>,
    pub pinned: Vec<String>,
    /// chosen course code -> requirement id
    pub chosen_to_requirement: BTreeMap<String, String>,
    pub pool_diagnostics: Option<PoolDiagnostics>,
}

fn collect_from_selected_branches(
    nodes: &[RequirementWithStatus],
    selected_options: &BTreeMap<String, u32>,
    existing_ids: &mut HashSet<String>,
    out: &mut Vec<RemainingRequirement>,
) {
    for node in nodes {
        if node.complete {
            continue;
        }
        let is_or_like = node.req_type == "or_group" || node.req_type == "options_group";
        if is_or_like && node.requirement_id.is_some() {
            let rid = node.requirement_id.as_ref().unwrap();
            if let Some(&sel) = selected_options.get(rid) {
                if let Some(opt) = node.options.get(sel as usize) {
                    collect_from_selected_branches(
                        std::slice::from_ref(opt),
                        selected_options,
                        existing_ids,
                        out,
                    );
                }
            }
        } else {
            if let Some(rid) = &node.requirement_id {
                if !existing_ids.contains(rid)
                    && !node.candidate_courses.is_empty()
                    && node.credits_needed.unwrap_or(0.0) > 0.0
                {
                    existing_ids.insert(rid.clone());
                    out.push(RemainingRequirement {
                        requirement_id: rid.clone(),
                        req_type: node.req_type.clone(),
                        title: node.title.clone(),
                        candidate_courses: node.candidate_courses.clone(),
                        credits_needed: node.credits_needed.unwrap_or(0.0),
                        satisfied_by: node.satisfied_by.clone(),
                    });
                }
            }
            if !node.options.is_empty() {
                collect_from_selected_branches(&node.options, selected_options, existing_ids, out);
            }
        }
    }
}

fn build_effective_remaining(
    remaining: Vec<RemainingRequirement>,
    tree: &[RequirementWithStatus],
    selected_options: &BTreeMap<String, u32>,
) -> Vec<RemainingRequirement> {
    let mut existing_ids: HashSet<String> = remaining
        .iter()
        .map(|r| r.requirement_id.clone())
        .filter(|id| !id.is_empty())
        .collect();
    let mut branch: Vec<RemainingRequirement> = Vec::new();
    collect_from_selected_branches(tree, selected_options, &mut existing_ids, &mut branch);
    let mut out = remaining;
    out.extend(branch);
    out
}

struct ExpandedConstrained {
    individual: BTreeMap<String, Vec<String>>,
    group_token_selections: BTreeMap<String, BTreeMap<String, usize>>,
}

fn expand_constrained(raw: &BTreeMap<String, Vec<String>>) -> ExpandedConstrained {
    let mut individual: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut group_token_selections: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    for (req_id, codes) in raw {
        let mut individual_expanded: Vec<String> = Vec::new();
        let mut token_counts: BTreeMap<String, usize> = BTreeMap::new();
        for code in codes {
            if is_group_token(code) {
                let canonical = canonical_group_token(code);
                *token_counts.entry(canonical).or_insert(0) += 1;
            } else if !individual_expanded.contains(code) {
                individual_expanded.push(code.clone());
            }
        }
        if !individual_expanded.is_empty() {
            individual.insert(req_id.clone(), individual_expanded);
        }
        if !token_counts.is_empty() {
            group_token_selections.insert(req_id.clone(), token_counts);
        }
    }
    ExpandedConstrained {
        individual,
        group_token_selections,
    }
}

/// reqId -> (prefix -> count) aggregated pending group picks.
fn build_pending_group_picks(
    group_token_selections: &BTreeMap<String, BTreeMap<String, usize>>,
) -> BTreeMap<String, BTreeMap<String, usize>> {
    let mut out: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    for (req_id, token_map) in group_token_selections {
        let mut agg: BTreeMap<String, usize> = BTreeMap::new();
        for (canonical, count) in token_map {
            if *count == 0 {
                continue;
            }
            let pfx = group_token_prefix(canonical);
            *agg.entry(pfx).or_insert(0) += count;
        }
        if !agg.is_empty() {
            out.insert(req_id.clone(), agg);
        }
    }
    out
}

pub fn generate_advanced(params: AdvancedParams) -> AdvancedResult {
    let data = params.data;
    let constraints = params.constraints;
    let include_closed = params.include_closed;
    let virtual_sections_only = params.virtual_sections_only;
    let french_immersion_stream = params.french_immersion_stream;

    let effective_seed = if params.current_seed != 0 {
        params.current_seed
    } else {
        params.first_seed
    };
    let mut rng = Rng::new(scramble_seed(effective_seed));
    let mut arrangement_rng = Rng::new(scramble_seed(effective_seed) ^ 0x9e37_79b9);

    let effective_remaining = build_effective_remaining(
        params.remaining_requirements,
        &params.requirement_tree,
        &params.selected_options_per_requirement,
    );

    let ExpandedConstrained {
        individual: constrained_per_requirement,
        group_token_selections,
    } = expand_constrained(&params.constrained_per_requirement_raw);

    let mut explicit_exempt: Vec<String> = Vec::new();
    for codes in constrained_per_requirement.values() {
        for code in codes {
            if !is_group_token(code) {
                let n = normalize_course_code(code);
                if !explicit_exempt.contains(&n) {
                    explicit_exempt.push(n);
                }
            }
        }
    }
    for codes in params.selected_per_requirement.values() {
        for code in codes {
            if !is_group_token(code) {
                let n = normalize_course_code(code);
                if !explicit_exempt.contains(&n) {
                    explicit_exempt.push(n);
                }
            }
        }
    }

    let mut requirement_type_by_id: HashMap<String, String> = HashMap::new();
    for req in &effective_remaining {
        if !req.requirement_id.is_empty() {
            requirement_type_by_id.insert(req.requirement_id.clone(), req.req_type.clone());
        }
    }

    let completed_set: HashSet<String> = params
        .completed_courses
        .iter()
        .map(|c| normalize_course_code(c))
        .collect();
    let prereq_eligible_set: HashSet<String> =
        params.prereq_eligible_courses.iter().cloned().collect();
    let blacklisted_set: HashSet<String> = params
        .blacklisted_courses
        .iter()
        .map(|c| normalize_course_code(c))
        .collect();
    let excluded_elective_prefixes: HashSet<String> = params
        .basic_excluded_categories
        .iter()
        .map(|c| c.to_ascii_lowercase())
        .collect();

    let is_excluded_elective_subject = |code: &str, pool_type: Option<&str>| -> bool {
        if excluded_elective_prefixes.is_empty() {
            return false;
        }
        match pool_type {
            Some(t) if is_broad_elective_pool_type(t) => {}
            _ => return false,
        }
        let prefix = subject_prefix(code).to_ascii_lowercase();
        excluded_elective_prefixes.contains(&prefix)
    };

    let eff_sched = |code: &str, virtual_only: bool| data.effective_schedule(code, include_closed, virtual_only);

    // --- honours selections ---
    let all_constrained: Vec<String> = constrained_per_requirement
        .values()
        .flat_map(|v| v.iter().cloned())
        .collect();
    let mut unique_constrained: Vec<String> = Vec::new();
    for c in &all_constrained {
        if !unique_constrained.contains(c) {
            unique_constrained.push(c.clone());
        }
    }

    let mut honours_selected: Vec<String> = Vec::new();
    let mut seen_honours: HashSet<String> = HashSet::new();
    let consider_honours = |code: &str,
                                honours_selected: &mut Vec<String>,
                                seen_honours: &mut HashSet<String>| {
        if !data.is_honours_project(code) {
            return;
        }
        let norm = normalize_course_code(code);
        if completed_set.contains(&norm) {
            return;
        }
        if !prereq_eligible_set.contains(code) {
            return;
        }
        if seen_honours.contains(&norm) {
            return;
        }
        seen_honours.insert(norm);
        honours_selected.push(code.to_string());
    };
    for code in &unique_constrained {
        consider_honours(code, &mut honours_selected, &mut seen_honours);
    }
    for codes in params.selected_per_requirement.values() {
        for code in codes {
            consider_honours(code, &mut honours_selected, &mut seen_honours);
        }
    }

    // implicit honours
    let mut implicit_honours_req_id: HashMap<String, String> = HashMap::new();
    {
        let picks = collect_implicit_honours(
            &effective_remaining,
            &params.selected_per_requirement,
            &completed_set,
            &prereq_eligible_set,
            data,
            include_closed,
            virtual_sections_only,
            &explicit_exempt,
            &mut seen_honours,
        );
        for (code, req_id) in picks {
            honours_selected.push(code.clone());
            implicit_honours_req_id.insert(normalize_course_code(&code), req_id);
        }
    }

    let honours_count = honours_selected.len();
    let effective_target = params.courses_this_semester.saturating_sub(honours_count);

    // explicit union (non-honours constrained, schedulable, eligible)
    let mut explicit_union: Vec<String> = Vec::new();
    let mut explicit_set: HashSet<String> = HashSet::new();
    for code in &unique_constrained {
        if data.is_honours_project(code) {
            continue;
        }
        if eff_sched(code, false).is_none()
            || completed_set.contains(&normalize_course_code(code))
            || !prereq_eligible_set.contains(code)
        {
            continue;
        }
        if !explicit_set.contains(code) {
            explicit_set.insert(code.clone());
            explicit_union.push(code.clone());
        }
    }

    let pin_all_explicit = !explicit_union.is_empty() && explicit_union.len() < effective_target;
    let explicit_only = explicit_union.len() >= effective_target && effective_target > 0;

    // forced courses
    let mut forced_pinned: Vec<String> = Vec::new();
    let mut forced_seen: HashSet<String> = HashSet::new();
    for code in &params.forced_courses {
        let norm = normalize_course_code(code);
        if forced_seen.contains(&norm) || completed_set.contains(&norm) {
            continue;
        }
        if data.is_honours_project(code) {
            continue;
        }
        let sched = match eff_sched(code, false) {
            Some(s) => s,
            None => continue,
        };
        if !has_valid_section_combos(&sched, constraints) {
            continue;
        }
        forced_seen.insert(norm.clone());
        forced_pinned.push(code.clone());
        if !explicit_exempt.contains(&norm) {
            explicit_exempt.push(norm);
        }
    }

    let mut pinned: Vec<String> = honours_selected.clone();
    if pin_all_explicit {
        for code in &explicit_union {
            if !pinned.contains(code) {
                pinned.push(code.clone());
            }
        }
    }
    for code in &forced_pinned {
        if !pinned.contains(code) {
            pinned.push(code.clone());
        }
    }

    let constrained_ref = &constrained_per_requirement;
    let selected_ref = &params.selected_per_requirement;
    let implicit_ref = &implicit_honours_req_id;
    let requirement_id_for_pinned = |code: &str| -> Option<String> {
        let norm = normalize_course_code(code);
        for (req_id, codes) in constrained_ref {
            if codes.iter().any(|c| normalize_course_code(c) == norm) {
                return Some(req_id.clone());
            }
        }
        if let Some(r) = implicit_ref.get(&norm) {
            return Some(r.clone());
        }
        for (req_id, codes) in selected_ref {
            if codes.iter().any(|c| normalize_course_code(c) == norm) {
                return Some(req_id.clone());
            }
        }
        None
    };

    let non_honours_pinned_count = pinned.iter().filter(|c| !data.is_honours_project(c)).count();
    let remaining_needed = effective_target.saturating_sub(non_honours_pinned_count);

    let mut filtered_optional_pool: Vec<String> = Vec::new();
    let mut found_schedule: Option<Vec<Enrollment>> = None;
    let mut pool_diagnostics: Option<PoolDiagnostics> = None;
    let mut chosen_to_requirement: BTreeMap<String, String> = BTreeMap::new();

    let is_eligible_candidate = |code: &str, pool_type: Option<&str>| -> bool {
        let norm = normalize_course_code(code);
        let virtual_only =
            virtual_schedule_filter_applies(virtual_sections_only, pool_type, &norm, &explicit_exempt);
        let sched = match eff_sched(code, virtual_only) {
            Some(s) => s,
            None => return false,
        };
        if pinned.iter().any(|p| p == code)
            || completed_set.contains(&norm)
            || !prereq_eligible_set.contains(code)
            || !course_matches_filters(code, &params.level_buckets, &params.language_buckets)
        {
            return false;
        }
        if data.is_honours_project(code) {
            return false;
        }
        if is_elective_requirement_type(pool_type.unwrap_or("")) && !is_within_elective_level_cap(code)
        {
            return false;
        }
        if is_excluded_elective_subject(code, pool_type) {
            return false;
        }
        if !has_valid_section_combos(&sched, constraints) {
            return false;
        }
        if blacklisted_set.contains(&norm) {
            return false;
        }
        true
    };

    if remaining_needed > 0 {
        // Build pools with pinned/selected credits subtracted.
        let all_pools = build_requirement_pools(&effective_remaining);
        let mut pools: Vec<RequirementPool> = all_pools
            .into_iter()
            .map(|pool| {
                let constrained_for_pool = constrained_per_requirement
                    .get(&pool.requirement_id)
                    .cloned()
                    .unwrap_or_default();
                let selected_for_pool = params
                    .selected_per_requirement
                    .get(&pool.requirement_id)
                    .cloned()
                    .unwrap_or_default();
                let mut pinned_credits = 0.0;
                for code in &pinned {
                    let primary = requirement_id_for_pinned(code);
                    if let Some(primary) = primary {
                        if pool.requirement_id != primary {
                            continue;
                        }
                        pinned_credits += data.credits(code);
                        continue;
                    }
                    if !pool.candidate_courses.contains(code)
                        && !constrained_for_pool.contains(code)
                    {
                        continue;
                    }
                    pinned_credits += data.credits(code);
                }
                let mut completed_selected_credits = 0.0;
                for code in &selected_for_pool {
                    if !completed_set.contains(&normalize_course_code(code)) {
                        continue;
                    }
                    completed_selected_credits += data.credits(code);
                }
                let remaining_credits =
                    (pool.credits_needed - pinned_credits - completed_selected_credits).max(0.0);
                RequirementPool {
                    credits_needed: remaining_credits,
                    ..pool
                }
            })
            .filter(|pool| pool.credits_needed > 0.0)
            .collect();

        // Drop course/or_course pools whose every candidate is unschedulable.
        pools.retain(|pool| {
            if pool.req_type != "course" && pool.req_type != "or_course" {
                return true;
            }
            pool.candidate_courses.iter().any(|code| {
                if data.is_honours_project(code) {
                    return false;
                }
                let norm = normalize_course_code(code);
                let vo = virtual_schedule_filter_applies(
                    virtual_sections_only,
                    Some(pool.req_type.as_str()),
                    &norm,
                    &explicit_exempt,
                );
                eff_sched(code, vo).is_some()
            })
        });

        // candidatesByRequirement
        let mut candidates_by_requirement: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for pool in &pools {
            let mut candidates: Vec<String> = Vec::new();
            for code in &pool.candidate_courses {
                let norm = normalize_course_code(code);
                let vo = virtual_schedule_filter_applies(
                    virtual_sections_only,
                    Some(pool.req_type.as_str()),
                    &norm,
                    &explicit_exempt,
                );
                let sched = match eff_sched(code, vo) {
                    Some(s) => s,
                    None => continue,
                };
                if pinned.iter().any(|p| p == code)
                    || params.completed_courses.iter().any(|c| c == code)
                    || !prereq_eligible_set.contains(code)
                    || !course_matches_filters(code, &params.level_buckets, &params.language_buckets)
                {
                    continue;
                }
                if is_elective_requirement_type(&pool.req_type) && !is_within_elective_level_cap(code)
                {
                    continue;
                }
                if is_excluded_elective_subject(code, Some(pool.req_type.as_str())) {
                    continue;
                }
                if !params.elective_level_buckets.is_empty()
                    && is_broad_elective_pool_type(&pool.req_type)
                {
                    if let Some(num) = first_four_digit_number(code) {
                        let bucket = (num / 1000) * 1000;
                        if !params.elective_level_buckets.contains(&bucket) {
                            continue;
                        }
                    }
                }
                if data.is_honours_project(code) {
                    continue;
                }
                if blacklisted_set.contains(&norm) {
                    continue;
                }
                if !has_valid_section_combos(&sched, constraints) {
                    continue;
                }
                candidates.push(code.clone());
            }
            if !candidates.is_empty() {
                candidates_by_requirement.insert(pool.requirement_id.clone(), candidates);
            }
        }

        let pools_with_no_candidates: Vec<RequirementPool> = pools
            .iter()
            .filter(|p| !candidates_by_requirement.contains_key(&p.requirement_id))
            .cloned()
            .collect();
        pools.retain(|p| candidates_by_requirement.contains_key(&p.requirement_id));

        let courses_per_pool = compute_courses_per_pool(&pools, remaining_needed);
        let pool_caps = build_pool_caps(&pools);
        let redistribution_alts =
            enumerate_single_redistributions(&courses_per_pool, &pools, &pool_caps);

        let mut high_level_pool_ids: HashSet<String> = HashSet::new();
        for pool in &pools {
            if is_broad_elective_pool_type(&pool.req_type) {
                continue;
            }
            let cands = candidates_by_requirement
                .get(&pool.requirement_id)
                .cloned()
                .unwrap_or_default();
            if !cands.is_empty() && cands.iter().all(|c| course_level_sort_key(c) >= 2000) {
                high_level_pool_ids.insert(pool.requirement_id.clone());
            }
        }
        let high_level_redist_alts: Vec<BTreeMap<String, usize>> = redistribution_alts
            .iter()
            .filter(|alt| {
                alt.iter().any(|(id, count)| {
                    high_level_pool_ids.contains(id)
                        && *count < *courses_per_pool.get(id).unwrap_or(&0)
                })
            })
            .cloned()
            .collect();

        let pending_base = build_pending_group_picks(&group_token_selections);

        let mut last_filtered_pool: Vec<String> = Vec::new();

        // Seeded one-time shuffle of candidate lists (per-seed value-ordering variety).
        for list in candidates_by_requirement.values_mut() {
            if !french_immersion_stream {
                shuffle_in_place(list, &mut rng);
            }
        }

        // Pinned courses are always part of the timetable; precompute their
        // (code, virtual-only) feasibility keys once.
        let vo_for = |code: &str, req_type: Option<&str>| -> bool {
            virtual_schedule_filter_applies(
                virtual_sections_only,
                req_type,
                &normalize_course_code(code),
                &explicit_exempt,
            )
        };
        let mut pinned_placed: Vec<(String, bool)> = Vec::with_capacity(pinned.len());
        for code in &pinned {
            let req_type = requirement_id_for_pinned(code)
                .and_then(|r| requirement_type_by_id.get(&r).cloned());
            pinned_placed.push((code.clone(), vo_for(code, req_type.as_deref())));
        }

        // Combos are probed many times during feasibility-aware selection; build
        // them lazily once and reuse across allocations.
        let mut arena = ComboArena::new(
            data,
            constraints,
            include_closed,
            scramble_seed(effective_seed) ^ 0x5151_5151,
        );

        // Deterministic allocation order: primary courses_per_pool first, then the
        // high-level redistributions, then the remaining single redistributions.
        let mut allocations: Vec<BTreeMap<String, usize>> = vec![courses_per_pool.clone()];
        for alt in &high_level_redist_alts {
            if !allocations.iter().any(|a| a == alt) {
                allocations.push(alt.clone());
            }
        }
        for alt in &redistribution_alts {
            if !allocations.iter().any(|a| a == alt) {
                allocations.push(alt.clone());
            }
        }

        for alloc in &allocations {
            if found_schedule.is_some() {
                break;
            }
            if let Some((chosen_map, arranged)) = run_pool_pick_pass(
                alloc,
                &pools,
                &candidates_by_requirement,
                &constrained_per_requirement,
                &pinned,
                &pinned_placed,
                &explicit_set,
                explicit_only,
                &pending_base,
                &requirement_id_for_pinned,
                data,
                &is_eligible_candidate,
                params.prefer_easier,
                params.course_aplus,
                &vo_for,
                &mut arena,
                &mut rng,
            ) {
                last_filtered_pool = chosen_map
                    .keys()
                    .filter(|code| !pinned.contains(*code))
                    .cloned()
                    .collect();
                chosen_to_requirement = chosen_map;
                found_schedule = Some(arranged);
            }
        }

        filtered_optional_pool = last_filtered_pool;
        pool_diagnostics = Some(PoolDiagnostics {
            empty_pools: pools_with_no_candidates
                .into_iter()
                .map(|p| EmptyPool {
                    label: p.label,
                    requirement_id: p.requirement_id,
                    candidate_courses: p.candidate_courses,
                })
                .collect(),
            total_available: pinned.len() + filtered_optional_pool.len(),
            total_needed: params.courses_this_semester,
        });
    }

    if remaining_needed == 0 {
        filtered_optional_pool = Vec::new();
        let resolver = FnResolver {
            data,
            include_closed,
            virtual_for: |_code: &str| false,
        };
        let arranged = first_seeded_arrangement(
            &pinned,
            data,
            &resolver,
            constraints,
            &mut arrangement_rng,
        );
        if let Some(arranged) = arranged {
            for code in &pinned {
                if let Some(rid) = requirement_id_for_pinned(code) {
                    if !data.is_honours_project(code) {
                        chosen_to_requirement.insert(code.clone(), rid);
                    }
                }
            }
            found_schedule = Some(arranged);
        }
    }

    AdvancedResult {
        schedule: found_schedule,
        filtered_optional_pool,
        pinned,
        chosen_to_requirement,
        pool_diagnostics,
    }
}

/// Lazy `(code, virtual_only)` → prebuilt section combos cache. Combos are
/// expensive to build, are reused across allocation attempts, and (because the
/// concrete-timetable search holds long-lived references to them) must live in a
/// stable location — hence the boxed arena.
struct ComboArena<'a> {
    data: &'a DataView,
    constraints: &'a Constraints,
    include_closed: bool,
    rng: Rng,
    built: Vec<Box<TimetableCourse>>,
    index: HashMap<(String, bool), Option<usize>>,
}

impl<'a> ComboArena<'a> {
    fn new(data: &'a DataView, constraints: &'a Constraints, include_closed: bool, seed: u32) -> Self {
        ComboArena {
            data,
            constraints,
            include_closed,
            rng: Rng::new(seed),
            built: Vec::new(),
            index: HashMap::new(),
        }
    }

    /// Index of the prebuilt combos for `(code, virtual_only)`, building (and
    /// caching) them on first use. `None` means the course cannot be scheduled.
    fn course_idx(&mut self, code: &str, virtual_only: bool) -> Option<usize> {
        let key = (code.to_string(), virtual_only);
        if let Some(slot) = self.index.get(&key) {
            return *slot;
        }
        let resolver = FnResolver {
            data: self.data,
            include_closed: self.include_closed,
            virtual_for: |_: &str| virtual_only,
        };
        let built = build_timetable_course(code, self.data, &resolver, self.constraints, &mut self.rng);
        let slot = match built {
            Some(tc) => {
                self.built.push(Box::new(tc));
                Some(self.built.len() - 1)
            }
            None => None,
        };
        self.index.insert(key, slot);
        slot
    }
}

/// One optional candidate within a pool's fill order.
struct Cand {
    code: String,
    combo_idx: usize,
    prefix: String,
    is_s: bool,
}

/// A pool to fill: its quota is satisfied by placing `need_s` constrained
/// (S-pick) courses plus `need_g` general (G) courses, honouring any group-token
/// per-prefix minimums (`pending`).
struct PoolFill {
    req_id: String,
    need_s: usize,
    need_g: usize,
    pending: BTreeMap<String, usize>,
    order: Vec<Cand>,
}

impl PoolFill {
    fn need(&self) -> usize {
        self.need_s + self.need_g
    }
}

/// Per-restart cap on cheap placement probes. A restart that can't pack the
/// target this cheaply has wandered into a dead end; bailing here (and
/// restarting with a fresh shuffle) is far cheaper than letting it thrash, and
/// empirically maximizes feasible-packs-per-unit-time near the capacity limit.
const SELECTION_PLACEMENT_BUDGET: u64 = 400;

/// Restart ceiling. The real limiter is [`SELECTION_GLOBAL_WORK_BUDGET`]; this
/// is just a high safety bound on the loop count (each restart reshuffles the
/// candidate order, so independent restarts drive the chance that *every* one
/// stalls to effectively zero — making success independent of the seed).
const SELECTION_RESTARTS: u32 = 100_000;


/// Hard global cap on placement *work* across the WHOLE generation call (shared
/// by every restart). The unit is overlap-check work, not attempts: each cheap
/// placement probe charges O(courses-already-placed) (see [`Search::try_place`]),
/// so this is a genuine wall-clock bound that holds regardless of pool density
/// or course count — a sparse pool (many cheap probes) and a near-capacity one
/// (fewer, expensive probes) both stop at roughly the same elapsed time. This is
/// what makes latency a function of the inputs, not the seed: any request —
/// feasible, near-capacity, or outright impossible (e.g. 24+ courses, which
/// exceeds the weekly slot budget) — stops here and reports "no schedule"
/// quickly instead of grinding into the worker's wall-clock kill. Sized so the
/// worst case stays well under the 3 s worker timeout even as WASM (~1.5-2x this
/// native build).
const SELECTION_GLOBAL_WORK_BUDGET: u64 = 200_000_000;

/// Global cap on full timetable re-solves across the WHOLE generation call.
/// Cheap fixed-arrangement placement (see [`Search::try_place`]) is both the
/// reliable and the fast path near the capacity limit; expensive re-solves
/// barely move reliability yet are unbounded by the cheap-probe budget, so they
/// are disabled by default to keep latency a clean function of the probe budget.
const SELECTION_RESOLVE_TOTAL: u64 = 0;

/// Node budget for a single *selection* re-solve. Far tighter than the one-shot
/// [`crate::timetable`] full-solve budget: a rearrangement that needs a deep
/// search rarely pays off versus trying another candidate or restart, and an
/// unbounded probe over a 20+ course set is what made the worst case explode.
const SELECTION_ARRANGE_NODE_BUDGET: u64 = 20_000;



/// Mutable per-position progress while filling a single pool.
struct FillProgress {
    idx: usize,
    s_used: usize,
    g_used: usize,
    count: usize,
    prefix_used: BTreeMap<String, usize>,
}

/// Joint, quota-aware subset selection + timetabling. Unlike the former
/// generate-and-test (pick a full course set at random, then check whether it
/// timetables), this fills each pool by trying candidate courses in seeded order
/// and accepting one only when the *whole* selection (pinned + already-selected +
/// candidate) still timetables — verified by a full re-solve
/// ([`arrange_prebuilt`]), which is free to rearrange every course's sections so
/// an early section choice never blocks a later required course.
struct Search<'a> {
    built: &'a [Box<TimetableCourse>],
    pinned: &'a [usize],
    pools_fill: &'a [PoolFill],
    constraints: &'a Constraints,
    data: &'a DataView,
    selected: Vec<usize>,
    assign: BTreeMap<String, String>,
    used: HashSet<String>,
    budget: u64,
    global: u64,
    resolve_budget: u64,
    arrange_nodes: u64,
    arrangement: Option<Vec<Enrollment>>,
}

impl<'a> Search<'a> {
    fn run(&mut self) -> bool {
        match self.resolve_with(None) {
            Some(arr) => self.arrangement = Some(arr),
            None => return false,
        }
        self.fill_from(0)
    }

    fn resolve_with(&self, extra: Option<usize>) -> Option<Vec<Enrollment>> {
        let mut refs: Vec<&TimetableCourse> =
            Vec::with_capacity(self.pinned.len() + self.selected.len() + 1);
        for &i in self.pinned {
            refs.push(self.built[i].as_ref());
        }
        for &i in &self.selected {
            refs.push(self.built[i].as_ref());
        }
        if let Some(i) = extra {
            refs.push(self.built[i].as_ref());
        }
        arrange_prebuilt_with_budget(&refs, self.constraints, self.data, self.arrange_nodes)
    }

    /// Feasibility-preserving placement of candidate `extra` onto the current
    /// arrangement. We place `extra` iff the full set (pinned + selected + extra)
    /// can be timetabled — identical to [`resolve_with`] — but we first try the
    /// cheap case: keep every already-placed section fixed and slot `extra` into
    /// the first of its combos that is conflict-free with the current
    /// arrangement (and still globally valid). That holds for the vast majority
    /// of placements during a descent (the schedule has slack), turning an
    /// O(whole-set re-solve) probe into an O(combos) overlap scan. Only when no
    /// combo fits the *fixed* arrangement do we fall back to a full re-solve,
    /// which is free to rearrange earlier sections — so the accept/reject
    /// decision is exactly the re-solve's, just reached far more cheaply.
    fn try_place(&mut self, extra: usize) -> Option<Vec<Enrollment>> {
        if let Some(cur) = self.arrangement.as_ref() {
            let placed = cur.len() as u64;
            for combo in &self.built[extra].combos {
                // Charge the global budget by the real work of this probe so the
                // budget is a genuine wall-clock bound — independent of pool
                // density or course count, a near-capacity descent (deep,
                // expensive probes) and a sparse one (shallow, cheap probes) both
                // stop at roughly the same elapsed time. An overlap scan costs
                // O(placed); a combo that *fits* additionally pays the
                // arrangement clone + final-constraint check (another O(placed)),
                // which dominates on permissive pools where most combos fit.
                self.global = self.global.saturating_sub(placed + 1);
                if allows_enrollment(combo, cur) {
                    self.global = self.global.saturating_sub(2 * (placed + 1));
                    let mut next = cur.clone();
                    next.push(combo.clone());
                    if passes_final(&next, self.constraints, self.data) {
                        return Some(next);
                    }
                }
                if self.global == 0 {
                    return None;
                }
            }
        }
        // Cheap fit failed: a full re-solve might still place `extra` by
        // rearranging earlier sections. Those re-solves are the expensive part of
        // a stuck descent, so they get their own small per-restart budget — once
        // spent, remaining ill-fitting candidates are simply skipped and the pass
        // restarts (with a fresh shuffle) rather than grinding through thousands
        // of full re-solves. Rearrangement power is retained across restarts, so
        // reliability holds while the worst-case stays far under the worker kill.
        if self.resolve_budget == 0 {
            return None;
        }
        self.resolve_budget -= 1;
        self.resolve_with(Some(extra))
    }

    fn fill_from(&mut self, pos: usize) -> bool {
        if pos == self.pools_fill.len() {
            return true;
        }
        let pool = &self.pools_fill[pos];
        let mut fp = FillProgress {
            idx: 0,
            s_used: 0,
            g_used: 0,
            count: 0,
            prefix_used: BTreeMap::new(),
        };
        self.fill_pool(pos, pool, &mut fp)
    }

    fn pool_forward_ok(&self, pool: &PoolFill, fp: &FillProgress) -> bool {
        let need_s_left = pool.need_s.saturating_sub(fp.s_used);
        let need_g_left = pool.need_g.saturating_sub(fp.g_used);
        let mut s_avail = 0usize;
        let mut g_avail = 0usize;
        let mut prefix_avail: BTreeMap<String, usize> = BTreeMap::new();
        for c in &pool.order[fp.idx..] {
            if self.used.contains(&c.code) {
                continue;
            }
            if c.is_s {
                s_avail += 1;
            } else {
                g_avail += 1;
            }
            if pool.pending.contains_key(&c.prefix) {
                *prefix_avail.entry(c.prefix.clone()).or_insert(0) += 1;
            }
        }
        if s_avail < need_s_left || g_avail < need_g_left {
            return false;
        }
        for (pfx, min) in &pool.pending {
            let used_p = fp.prefix_used.get(pfx).copied().unwrap_or(0);
            if used_p < *min {
                let need_p = min - used_p;
                if prefix_avail.get(pfx).copied().unwrap_or(0) < need_p {
                    return false;
                }
            }
        }
        true
    }

    fn fill_pool(&mut self, pos: usize, pool: &'a PoolFill, fp: &mut FillProgress) -> bool {
        if fp.count == pool.need() {
            for (pfx, min) in &pool.pending {
                if fp.prefix_used.get(pfx).copied().unwrap_or(0) < *min {
                    return false;
                }
            }
            return self.fill_from(pos + 1);
        }
        if self.budget == 0 || self.global == 0 || fp.idx >= pool.order.len() {
            return false;
        }
        // Charge the forward-feasibility scan (O(remaining pool)); it runs at
        // every node and dominates the per-node cost on large pools, so it must
        // be metered for the global budget to bound wall time rather than just
        // placement attempts.
        self.global = self.global.saturating_sub((pool.order.len() - fp.idx) as u64);
        if !self.pool_forward_ok(pool, fp) {
            return false;
        }

        let c = &pool.order[fp.idx];
        let cap_ok = if c.is_s {
            fp.s_used < pool.need_s
        } else {
            fp.g_used < pool.need_g
        };

        if cap_ok && !self.used.contains(&c.code) {
            self.budget = self.budget.saturating_sub(1);
            if let Some(arr) = self.try_place(c.combo_idx) {
                let prev = self.arrangement.take();
                self.arrangement = Some(arr);
                self.selected.push(c.combo_idx);
                self.used.insert(c.code.clone());
                self.assign.insert(c.code.clone(), pool.req_id.clone());
                fp.idx += 1;
                fp.count += 1;
                if c.is_s {
                    fp.s_used += 1;
                } else {
                    fp.g_used += 1;
                }
                *fp.prefix_used.entry(c.prefix.clone()).or_insert(0) += 1;

                if self.fill_pool(pos, pool, fp) {
                    return true;
                }

                if let Some(v) = fp.prefix_used.get_mut(&c.prefix) {
                    *v -= 1;
                }
                if c.is_s {
                    fp.s_used -= 1;
                } else {
                    fp.g_used -= 1;
                }
                fp.count -= 1;
                fp.idx -= 1;
                self.assign.remove(&c.code);
                self.used.remove(&c.code);
                self.selected.pop();
                self.arrangement = prev;
            }
        }

        fp.idx += 1;
        let skipped = self.fill_pool(pos, pool, fp);
        fp.idx -= 1;
        skipped
    }
}

/// Builds a weighted-random permutation of `items` (each `(cand, weight)`), so
/// higher-weighted candidates tend to appear earlier and are therefore preferred
/// by the place-first search — preserving the level / prefer-easier soft biases
/// while keeping per-seed variety.
fn weighted_permutation(mut items: Vec<(Cand, f64)>, rng: &mut Rng) -> Vec<Cand> {
    let mut out: Vec<Cand> = Vec::with_capacity(items.len());
    while !items.is_empty() {
        let weights: Vec<f64> = items.iter().map(|x| x.1).collect();
        let pick = weighted_random_pick_index(&weights, rng);
        out.push(items.remove(pick).0);
    }
    out
}

/// Runs one feasibility-aware selection pass for a single per-pool allocation.
/// Returns the chosen `code -> requirement_id` map (including pinned non-honours
/// courses) together with the proven conflict-free arrangement, or `None` if no
/// requirement-satisfying, timetable-feasible selection exists for this
/// allocation (within the deterministic search budget).
#[allow(clippy::too_many_arguments)]
fn run_pool_pick_pass(
    per_pool_need: &BTreeMap<String, usize>,
    pools: &[RequirementPool],
    candidates_by_requirement: &BTreeMap<String, Vec<String>>,
    constrained_per_requirement: &BTreeMap<String, Vec<String>>,
    pinned: &[String],
    pinned_placed: &[(String, bool)],
    explicit_set: &HashSet<String>,
    explicit_only: bool,
    pending_base: &BTreeMap<String, BTreeMap<String, usize>>,
    requirement_id_for_pinned: &dyn Fn(&str) -> Option<String>,
    data: &DataView,
    is_eligible_candidate: &dyn Fn(&str, Option<&str>) -> bool,
    prefer_easier: bool,
    course_aplus: &HashMap<String, f64>,
    vo_for: &dyn Fn(&str, Option<&str>) -> bool,
    arena: &mut ComboArena,
    rng: &mut Rng,
) -> Option<(BTreeMap<String, String>, Vec<Enrollment>)> {
    let chosen_codes: HashSet<String> = pinned.iter().cloned().collect();

    // Pinned non-honours requirement assignment (carried into the result map).
    let mut assign: BTreeMap<String, String> = BTreeMap::new();
    for code in pinned {
        if data.is_honours_project(code) {
            continue;
        }
        if let Some(rid) = requirement_id_for_pinned(code) {
            assign.insert(code.clone(), rid);
        }
    }

    // Group-token (pending) picks already satisfied by pinned courses.
    let mut pending_group_picks = pending_base.clone();
    for code in pinned {
        if data.is_honours_project(code) {
            continue;
        }
        let rid = match requirement_id_for_pinned(code) {
            Some(r) => r,
            None => continue,
        };
        if let Some(agg) = pending_group_picks.get_mut(&rid) {
            if agg.is_empty() {
                continue;
            }
            let pfx = subject_prefix(code);
            if let Some(cur) = agg.get_mut(&pfx) {
                if *cur > 0 {
                    *cur -= 1;
                }
            }
        }
    }

    let easier_mult = |code: &str| -> f64 {
        if !prefer_easier {
            return 1.0;
        }
        match course_aplus.get(code) {
            None => 1.0,
            Some(&a) => EASIER_APLUS_BASE.powf((a - EASIER_APLUS_PIVOT) / EASIER_APLUS_SCALE),
        }
    };

    let weight_of = |code: &str, level_counts: &HashMap<i64, usize>| -> f64 {
        let level = course_level_sort_key(code);
        let has_non_course_prereq = prerequisites_contain_non_course(
            data.get_course(code).and_then(|c| c.prerequisites.as_ref()),
        );
        let bucket_size = *level_counts.get(&level).unwrap_or(&1) as f64;
        (candidate_pool_weight(level, has_non_course_prereq) / bucket_size) * easier_mult(code)
    };

    // Build a fill descriptor for each pool with remaining quota.
    let mut pools_fill: Vec<PoolFill> = Vec::new();
    for pool in pools {
        let r = *per_pool_need.get(&pool.requirement_id).unwrap_or(&0);
        if r == 0 {
            continue;
        }
        let constrained_for_pool = constrained_per_requirement
            .get(&pool.requirement_id)
            .cloned()
            .unwrap_or_default();
        let s_list: Vec<String> = constrained_for_pool
            .iter()
            .filter(|code| is_eligible_candidate(code, Some(pool.req_type.as_str())))
            .cloned()
            .collect();
        let s_set: HashSet<String> = s_list.iter().cloned().collect();
        let candidates = candidates_by_requirement
            .get(&pool.requirement_id)
            .cloned()
            .unwrap_or_default();
        let s_avail: Vec<String> = s_list
            .iter()
            .filter(|code| !chosen_codes.contains(*code))
            .cloned()
            .collect();
        let mut g_avail: Vec<String> = candidates
            .iter()
            .filter(|code| !s_set.contains(*code) && !chosen_codes.contains(*code))
            .cloned()
            .collect();
        if explicit_only {
            g_avail.retain(|code| explicit_set.contains(code));
        }
        let need_s = r.min(s_avail.len());
        let need_g = r - need_s;
        if need_g > g_avail.len() {
            return None;
        }

        let pending: BTreeMap<String, usize> = pending_group_picks
            .get(&pool.requirement_id)
            .map(|agg| {
                agg.iter()
                    .filter(|(pfx, rem)| {
                        **rem > 0 && pool.candidate_courses.iter().any(|c| subject_prefix(c) == **pfx)
                    })
                    .map(|(pfx, rem)| (pfx.clone(), *rem))
                    .collect()
            })
            .unwrap_or_default();
        // Group-token minimums must be reachable within this pool's quota.
        let pending_total: usize = pending.values().sum();
        if pending_total > r {
            return None;
        }

        let req_type = pool.req_type.clone();
        let mut build_cands = |codes: &[String], is_s: bool| -> Vec<Cand> {
            let mut level_counts: HashMap<i64, usize> = HashMap::new();
            for code in codes {
                *level_counts.entry(course_level_sort_key(code)).or_insert(0) += 1;
            }
            let mut weighted: Vec<(Cand, f64)> = Vec::new();
            for code in codes {
                let vo = vo_for(code, Some(req_type.as_str()));
                let combo_idx = match arena.course_idx(code, vo) {
                    Some(i) => i,
                    None => continue,
                };
                weighted.push((
                    Cand {
                        code: code.clone(),
                        combo_idx,
                        prefix: subject_prefix(code),
                        is_s,
                    },
                    weight_of(code, &level_counts),
                ));
            }
            weighted_permutation(weighted, rng)
        };

        let mut order = build_cands(&s_avail, true);
        order.extend(build_cands(&g_avail, false));

        pools_fill.push(PoolFill {
            req_id: pool.requirement_id.clone(),
            need_s,
            need_g,
            pending,
            order,
        });
    }

    // Most-constrained pool first keeps cross-pool retries shallow.
    pools_fill.sort_by_key(|p| p.order.len());

    // Prebuild pinned combos; any unschedulable pinned course is fatal.
    let mut pinned_idx: Vec<usize> = Vec::with_capacity(pinned_placed.len());
    for (code, vo) in pinned_placed {
        pinned_idx.push(arena.course_idx(code, *vo)?);
    }
    pinned_idx.sort_by_key(|&i| arena.built[i].combos.len());

    // Randomized-restart greedy selection. Each restart greedily fills the pools
    // in a shuffled candidate order, accepting a course whenever the whole
    // selection still timetables (a feasibility-aware probe — see `try_place`).
    // A single order occasionally stalls a few courses short of `need` (a greedy
    // local maximum); rather than exhaustively backtrack that rare bad order —
    // which is what made the old generate-and-test seed-dependent — we reshuffle
    // and try again. Independent reshuffles drive the probability that *every*
    // restart stalls to effectively zero, so a feasible schedule is found for
    // every seed while total work stays bounded. The first restart keeps the
    // preference-weighted order (so the level / prefer-easier biases still shape
    // the result); later restarts use uniform reshuffles purely to find feasibility.
    //
    // Total work is hard-bounded by ONE global work budget shared across all
    // restarts (`SELECTION_GLOBAL_WORK_BUDGET`, charged per overlap-check so it
    // tracks wall time), so latency is a pure function of the inputs — never the
    // seed or wall clock. Any expensive full re-solves (disabled by default, see
    // `SELECTION_RESOLVE_TOTAL`) likewise share one budget, bounded to
    // `SELECTION_ARRANGE_NODE_BUDGET` nodes each.
    let restarts = SELECTION_RESTARTS;
    let placement_budget = SELECTION_PLACEMENT_BUDGET;
    let arrange_nodes = SELECTION_ARRANGE_NODE_BUDGET;
    let mut resolve_total = SELECTION_RESOLVE_TOTAL;
    let mut global = SELECTION_GLOBAL_WORK_BUDGET;
    for restart in 0..restarts {
        if global == 0 {
            break;
        }
        if restart > 0 {
            for pf in &mut pools_fill {
                shuffle_in_place(&mut pf.order, rng);
            }
        }
        let mut search = Search {
            built: &arena.built,
            pinned: &pinned_idx,
            pools_fill: &pools_fill,
            constraints: arena.constraints,
            data: arena.data,
            selected: Vec::new(),
            assign: assign.clone(),
            used: chosen_codes.clone(),
            budget: placement_budget,
            global,
            resolve_budget: resolve_total,
            arrange_nodes,
            arrangement: None,
        };
        if search.run() {
            return Some((search.assign, search.arrangement.unwrap_or_default()));
        }
        // Carry the remaining global budgets into the next restart so total work
        // (cheap probes + expensive re-solves) is hard-bounded regardless of how
        // many restarts that takes — making latency independent of feasibility.
        resolve_total = search.resolve_budget;
        global = search.global;
    }
    None
}

#[allow(clippy::too_many_arguments)]
fn collect_implicit_honours(
    effective_remaining: &[RemainingRequirement],
    selected_per_requirement: &BTreeMap<String, Vec<String>>,
    completed_set: &HashSet<String>,
    prereq_eligible_set: &HashSet<String>,
    data: &DataView,
    include_closed: bool,
    virtual_sections_only: bool,
    explicit_exempt: &[String],
    seen_honours: &mut HashSet<String>,
) -> Vec<(String, String)> {
    let mut picks: Vec<(String, String)> = Vec::new();
    for req in effective_remaining {
        let req_id = &req.requirement_id;
        if req_id.is_empty() || req.candidate_courses.is_empty() {
            continue;
        }
        if matches!(
            req.req_type.as_str(),
            "non_course"
                | "elective"
                | "discipline_elective"
                | "faculty_elective"
                | "free_elective"
                | "non_discipline_elective"
        ) {
            continue;
        }
        let assigned = selected_per_requirement.get(req_id);
        if let Some(a) = assigned {
            if a.is_empty() {
                continue;
            }
            if a.iter().any(|c| !data.is_honours_project(c)) {
                continue;
            }
        }

        let honours_cands: Vec<String> = req
            .candidate_courses
            .iter()
            .filter(|code| {
                if !data.is_honours_project(code) {
                    return false;
                }
                let norm = normalize_course_code(code);
                if completed_set.contains(&norm) {
                    return false;
                }
                prereq_eligible_set.contains(*code)
            })
            .cloned()
            .collect();

        let non_honours_with_schedule = req.candidate_courses.iter().any(|code| {
            if data.is_honours_project(code) {
                return false;
            }
            let norm = normalize_course_code(code);
            if completed_set.contains(&norm) {
                return false;
            }
            if !prereq_eligible_set.contains(code) {
                return false;
            }
            let vo = virtual_schedule_filter_applies(
                virtual_sections_only,
                Some(req.req_type.as_str()),
                &norm,
                explicit_exempt,
            );
            data.effective_schedule(code, include_closed, vo).is_some()
        });

        if non_honours_with_schedule {
            continue;
        }
        if honours_cands.len() != 1 {
            continue;
        }
        let only = &honours_cands[0];
        let norm = normalize_course_code(only);
        if seen_honours.contains(&norm) {
            continue;
        }
        seen_honours.insert(norm);
        picks.push((only.clone(), req_id.clone()));
    }
    picks
}
