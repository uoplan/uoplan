import type { DataCache } from "@uoplan/domain/dataCache";
import type { RemainingRequirement } from "@uoplan/requirements/requirements/types";
import { getCourseCredits, normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { isGroupToken } from "@uoplan/domain/utils/groupToken";
import type { DesiredCourseResolution } from "./resolveDesiredCourses";

/**
 * A remaining requirement the basket does not yet cover, with suggested courses the student could
 * add to make progress. Drives the cart's "still need" hints and the smart explore filter copy.
 */
export interface StillNeededRequirement {
  requirementId: string;
  title?: string;
  /** Gross credits the requirement needs (mirrors the resolver's `creditsNeeded`, default 3). */
  creditsNeeded: number;
  /** Credits already committed (completed/locked picks + basket courses assigned to it). */
  creditsCovered: number;
  /**
   * The requirement's full defining course pool (display codes, deduped, group tokens
   * excluded), used to label untitled requirements as their list of courses rather than a
   * raw requirement id. Includes courses the student already owns, unlike `suggestions`.
   */
  courseList: string[];
  /** Candidate course codes the student could add to cover this requirement (capped). */
  suggestions: string[];
  /**
   * Total number of addable candidate courses for this requirement (the pool `suggestions`
   * was sliced from, excluding completed/basket/committed courses). Lets the UI show a
   * "+N more" affordance when the pool is larger than the displayed suggestions.
   */
  suggestionPoolSize: number;
}

export interface ComputeStillNeededParams {
  /** The requirement universe (already collapsed to selected option branches). */
  remainingRequirements: RemainingRequirement[];
  /** Resolution of the current basket (gives per-requirement assignments). */
  resolution: DesiredCourseResolution;
  completedCourses: string[];
  constrainedPerRequirement: Record<string, string[]>;
  selectedPerRequirement: Record<string, string[]>;
  prereqEligibleCourses: string[];
  basketCourses: string[];
  cache: DataCache | null;
  /** Max suggested courses per requirement (default 6). */
  maxSuggestionsPerRequirement?: number;
}

const DEFAULT_CREDITS_NEEDED = 3;
const DEFAULT_MAX_SUGGESTIONS = 6;

/**
 * Computes which remaining requirements the current basket (plus completed/locked picks) does not
 * yet satisfy, and for each suggests candidate courses to add — prereq-eligible and offered this
 * term first. Pure (no store access) so it can be unit-tested and reused by the cart and filters.
 */
export function computeStillNeeded({
  remainingRequirements,
  resolution,
  completedCourses,
  constrainedPerRequirement,
  selectedPerRequirement,
  prereqEligibleCourses,
  basketCourses,
  cache,
  maxSuggestionsPerRequirement = DEFAULT_MAX_SUGGESTIONS,
}: ComputeStillNeededParams): StillNeededRequirement[] {
  if (!cache) return [];

  const completedSet = new Set(completedCourses.map((c) => cache.resolveToCanonical(c)));
  const basketSet = new Set(basketCourses.map((c) => cache.resolveToCanonical(c)));
  const prereqEligibleSet = new Set(prereqEligibleCourses);

  const stillNeeded: StillNeededRequirement[] = [];

  for (const req of remainingRequirements) {
    const creditsNeeded = req.creditsNeeded ?? DEFAULT_CREDITS_NEEDED;
    // Uncapped / pick-count requirements have no finite credit gap to report against.
    if (creditsNeeded <= 0) continue;

    // Credits already committed to this requirement: completed/locked picks + basket assignments.
    const committedSet = new Set<string>();
    let creditsCovered = 0;
    const committedCodes = [
      ...(constrainedPerRequirement[req.requirementId] ?? []),
      ...(selectedPerRequirement[req.requirementId] ?? []),
      ...(resolution.assigned[req.requirementId] ?? []),
    ];
    for (const code of committedCodes) {
      if (isGroupToken(code)) continue;
      const norm = normalizeCourseCode(code);
      if (committedSet.has(norm)) continue;
      committedSet.add(norm);
      creditsCovered += getCourseCredits(norm, cache);
    }

    if (creditsCovered >= creditsNeeded) continue;

    // Rank candidates: prereq-eligible AND offered this term first, then offered, then the rest.
    // Exclude anything already completed, already in the basket, or already committed here.
    const seen = new Set<string>();
    const courseList: string[] = [];
    const ranked: { code: string; rank: number; index: number }[] = [];
    for (const [index, candidate] of (req.candidateCourses ?? []).entries()) {
      if (isGroupToken(candidate)) continue;
      const canon = cache.resolveToCanonical(candidate);
      if (seen.has(canon)) continue;
      seen.add(canon);
      const display = cache.getCourse(canon)?.code ?? canon;
      // Defining pool for the requirement's label (kept even if already owned).
      courseList.push(display);
      if (completedSet.has(canon) || basketSet.has(canon) || committedSet.has(canon)) continue;
      const available = Boolean(cache.getSchedule(canon) || cache.getSchedule(display));
      const eligible = prereqEligibleSet.has(canon) || prereqEligibleSet.has(display);
      const rank = available ? (eligible ? 0 : 1) : 2;
      ranked.push({ code: display, rank, index });
    }
    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);

    stillNeeded.push({
      requirementId: req.requirementId,
      title: req.title,
      creditsNeeded,
      creditsCovered,
      courseList,
      suggestions: ranked.slice(0, maxSuggestionsPerRequirement).map((c) => c.code),
      suggestionPoolSize: ranked.length,
    });
  }

  return stillNeeded;
}
