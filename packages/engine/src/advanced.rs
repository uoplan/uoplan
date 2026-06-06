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
use crate::timetable::{first_seeded_arrangement, has_valid_section_combos, FnResolver};
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

        let mut seen_course_sets: HashSet<String> = HashSet::new();
        let mut last_filtered_pool: Vec<String> = Vec::new();

        for _attempt in 0..10_000usize {
            if found_schedule.is_some() {
                break;
            }

            for list in candidates_by_requirement.values_mut() {
                if !french_immersion_stream {
                    shuffle_in_place(list, &mut rng);
                }
            }

            let mut allocation_pool: Vec<&BTreeMap<String, usize>> = vec![&courses_per_pool];
            for alt in &high_level_redist_alts {
                allocation_pool.push(alt);
            }
            let pick_idx = (rng.next_f64() * allocation_pool.len() as f64).floor() as usize;
            let pick_idx = pick_idx.min(allocation_pool.len() - 1);
            let first_alloc = allocation_pool[pick_idx].clone();

            let mut pass = run_pool_pick_pass(
                &first_alloc,
                &pools,
                &candidates_by_requirement,
                &constrained_per_requirement,
                &pinned,
                &explicit_set,
                explicit_only,
                &pending_base,
                &requirement_id_for_pinned,
                data,
                &is_eligible_candidate,
                params.prefer_easier,
                params.course_aplus,
                &mut rng,
            );
            if pass.is_none() && first_alloc != courses_per_pool {
                pass = run_pool_pick_pass(
                    &courses_per_pool,
                    &pools,
                    &candidates_by_requirement,
                    &constrained_per_requirement,
                    &pinned,
                    &explicit_set,
                    explicit_only,
                    &pending_base,
                    &requirement_id_for_pinned,
                    data,
                    &is_eligible_candidate,
                    params.prefer_easier,
                    params.course_aplus,
                    &mut rng,
                );
            }
            if pass.is_none() {
                for alt in &redistribution_alts {
                    if *alt == first_alloc {
                        continue;
                    }
                    pass = run_pool_pick_pass(
                        alt,
                        &pools,
                        &candidates_by_requirement,
                        &constrained_per_requirement,
                        &pinned,
                        &explicit_set,
                        explicit_only,
                        &pending_base,
                        &requirement_id_for_pinned,
                        data,
                        &is_eligible_candidate,
                        params.prefer_easier,
                        params.course_aplus,
                        &mut rng,
                    );
                    if pass.is_some() {
                        break;
                    }
                }
            }

            let chosen_from_pool = match pass {
                Some(c) => c,
                None => continue,
            };

            let mut chosen_codes: Vec<String> = pinned.clone();
            for code in chosen_from_pool.keys() {
                if !chosen_codes.contains(code) {
                    chosen_codes.push(code.clone());
                }
            }
            let optional_pool: Vec<String> = chosen_codes
                .iter()
                .filter(|code| !pinned.contains(code))
                .cloned()
                .collect();
            let slots_from_optional = params.courses_this_semester.saturating_sub(pinned.len());
            if optional_pool.len() < slots_from_optional {
                if optional_pool.len() > last_filtered_pool.len() {
                    last_filtered_pool = optional_pool;
                }
                continue;
            }

            last_filtered_pool = optional_pool;
            shuffle_in_place(&mut last_filtered_pool, &mut rng);

            let chosen_from_pool_ref = &chosen_from_pool;
            let resolver = FnResolver {
                data,
                include_closed,
                virtual_for: |code: &str| {
                    let norm = normalize_course_code(code);
                    let req_id = chosen_from_pool_ref
                        .get(code)
                        .cloned()
                        .or_else(|| requirement_id_for_pinned(code));
                    let req_type = req_id
                        .as_ref()
                        .and_then(|r| requirement_type_by_id.get(r))
                        .map(|s| s.as_str());
                    virtual_schedule_filter_applies(
                        virtual_sections_only,
                        req_type,
                        &norm,
                        &explicit_exempt,
                    )
                },
            };

            let mut full_set: Vec<String> = pinned.clone();
            full_set.extend(last_filtered_pool.iter().cloned());
            let arranged = first_seeded_arrangement(
                &full_set,
                data,
                &resolver,
                constraints,
                &mut arrangement_rng,
            );
            if let Some(arranged) = arranged {
                let mut codes: Vec<String> =
                    arranged.iter().map(|e| e.course_code.clone()).collect();
                codes.sort();
                let fingerprint = codes.join(",");
                if !seen_course_sets.contains(&fingerprint) {
                    seen_course_sets.insert(fingerprint);
                    chosen_to_requirement = chosen_from_pool.clone();
                    found_schedule = Some(arranged);
                }
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

#[allow(clippy::too_many_arguments)]
fn run_pool_pick_pass(
    per_pool_need: &BTreeMap<String, usize>,
    pools: &[RequirementPool],
    candidates_by_requirement: &BTreeMap<String, Vec<String>>,
    constrained_per_requirement: &BTreeMap<String, Vec<String>>,
    pinned: &[String],
    explicit_set: &HashSet<String>,
    explicit_only: bool,
    pending_base: &BTreeMap<String, BTreeMap<String, usize>>,
    requirement_id_for_pinned: &dyn Fn(&str) -> Option<String>,
    data: &DataView,
    is_eligible_candidate: &dyn Fn(&str, Option<&str>) -> bool,
    prefer_easier: bool,
    course_aplus: &HashMap<String, f64>,
    rng: &mut Rng,
) -> Option<BTreeMap<String, String>> {
    let mut chosen_codes: HashSet<String> = pinned.iter().cloned().collect();
    let mut local_chosen_from_pool: BTreeMap<String, String> = BTreeMap::new();
    for code in pinned {
        if data.is_honours_project(code) {
            continue;
        }
        if let Some(rid) = requirement_id_for_pinned(code) {
            local_chosen_from_pool.insert(code.clone(), rid);
        }
    }

    let mut remaining: BTreeMap<String, usize> = BTreeMap::new();
    for pool in pools {
        let n = *per_pool_need.get(&pool.requirement_id).unwrap_or(&0);
        if n > 0 {
            remaining.insert(pool.requirement_id.clone(), n);
        }
    }

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

    let total_remaining = |rem: &BTreeMap<String, usize>| -> usize { rem.values().sum() };

    // pre-flight feasibility
    for pool in pools {
        let r = *remaining.get(&pool.requirement_id).unwrap_or(&0);
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
        let g_list: Vec<String> = candidates
            .iter()
            .filter(|code| !s_set.contains(*code))
            .cloned()
            .collect();
        let s_avail: Vec<String> = s_list
            .iter()
            .filter(|code| !chosen_codes.contains(*code))
            .cloned()
            .collect();
        let mut g_avail: Vec<String> = g_list
            .iter()
            .filter(|code| !chosen_codes.contains(*code))
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

        if let Some(pend) = pending_group_picks.get(&pool.requirement_id) {
            if !pend.is_empty() {
                let mut forced_in_pool = 0usize;
                for (pfx, rem) in pend {
                    if *rem == 0 {
                        continue;
                    }
                    if !pool.candidate_courses.iter().any(|c| subject_prefix(c) == *pfx) {
                        continue;
                    }
                    forced_in_pool += rem;
                }
                if forced_in_pool > r {
                    return None;
                }
                for (pfx, rem) in pend {
                    if *rem == 0 {
                        continue;
                    }
                    if !pool.candidate_courses.iter().any(|c| subject_prefix(c) == *pfx) {
                        continue;
                    }
                    let n_prefix_avail = candidates
                        .iter()
                        .filter(|c| {
                            subject_prefix(c) == *pfx
                                && !chosen_codes.contains(*c)
                                && is_eligible_candidate(c, Some(pool.req_type.as_str()))
                        })
                        .count();
                    if n_prefix_avail < *rem {
                        return None;
                    }
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

    while total_remaining(&remaining) > 0 {
        // (code, requirement_id, weight)
        let mut cands: Vec<(String, String, f64)> = Vec::new();

        for pool in pools {
            let r = *remaining.get(&pool.requirement_id).unwrap_or(&0);
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
            let g_list: Vec<String> = candidates
                .iter()
                .filter(|code| !s_set.contains(*code))
                .cloned()
                .collect();
            let s_avail: Vec<String> = s_list
                .iter()
                .filter(|code| !chosen_codes.contains(*code))
                .cloned()
                .collect();
            let mut g_avail: Vec<String> = g_list
                .iter()
                .filter(|code| !chosen_codes.contains(*code))
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

            let mut forced_prefix: Option<String> = None;
            if let Some(pend) = pending_group_picks.get(&pool.requirement_id) {
                for (pfx, rem) in pend {
                    if *rem == 0 {
                        continue;
                    }
                    if !pool.candidate_courses.iter().any(|c| subject_prefix(c) == *pfx) {
                        continue;
                    }
                    let has_avail = candidates.iter().any(|c| {
                        subject_prefix(c) == *pfx
                            && !chosen_codes.contains(c)
                            && is_eligible_candidate(c, Some(pool.req_type.as_str()))
                    });
                    if has_avail {
                        forced_prefix = Some(pfx.clone());
                        break;
                    }
                }
            }

            let list: Vec<String> = if let Some(ref pfx) = forced_prefix {
                let l: Vec<String> = candidates
                    .iter()
                    .filter(|c| {
                        subject_prefix(c) == *pfx
                            && !chosen_codes.contains(*c)
                            && is_eligible_candidate(c, Some(pool.req_type.as_str()))
                    })
                    .cloned()
                    .collect();
                if l.is_empty() {
                    return None;
                }
                l
            } else {
                let pick_from_s = need_s > 0;
                let l = if pick_from_s { s_avail } else { g_avail };
                if l.is_empty() {
                    continue;
                }
                l
            };

            let mut level_counts: HashMap<i64, usize> = HashMap::new();
            for code in &list {
                *level_counts.entry(course_level_sort_key(code)).or_insert(0) += 1;
            }

            for code in &list {
                let level = course_level_sort_key(code);
                let has_non_course_prereq = prerequisites_contain_non_course(
                    data.get_course(code).and_then(|c| c.prerequisites.as_ref()),
                );
                let bucket_size = *level_counts.get(&level).unwrap_or(&1) as f64;
                let weight = (candidate_pool_weight(level, has_non_course_prereq) / bucket_size)
                    * easier_mult(code);
                cands.push((code.clone(), pool.requirement_id.clone(), weight));
            }
        }

        if cands.is_empty() {
            break;
        }

        let weights: Vec<f64> = cands.iter().map(|c| c.2).collect();
        let idx = weighted_random_pick_index(&weights, rng);
        let (picked_code, picked_req, _) = cands[idx].clone();

        chosen_codes.insert(picked_code.clone());
        local_chosen_from_pool.insert(picked_code.clone(), picked_req.clone());
        if let Some(v) = remaining.get_mut(&picked_req) {
            *v -= 1;
            if *v == 0 {
                remaining.remove(&picked_req);
            }
        }

        if let Some(agg) = pending_group_picks.get_mut(&picked_req) {
            if !agg.is_empty() {
                let pfx = subject_prefix(&picked_code);
                if let Some(cur) = agg.get_mut(&pfx) {
                    if *cur > 0 {
                        *cur -= 1;
                    }
                }
            }
        }
    }

    if total_remaining(&remaining) > 0 {
        return None;
    }
    Some(local_chosen_from_pool)
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
