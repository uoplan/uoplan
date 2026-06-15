import type { RemainingRequirement, RequirementWithStatus } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";

/**
 * Removes `requirementId` and descendant option keys (req-0-0 under req-0)
 * from a selection map. Used when backing out of a branch.
 */
export function pruneOptionSelectionsForClear(
  selected: Record<string, number>,
  requirementId: string,
): Record<string, number> {
  const prefix = `${requirementId}-`;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(selected)) {
    if (k === requirementId) continue;
    if (k.startsWith(prefix)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Resolves which branch index applies for an `or_group` / `options_group`
 * (user pick in the Options step, else {@link RequirementWithStatus.satisfiedOptionIndex}).
 */
function selectedBranchIndexForOptionGroup(
  node: RequirementWithStatus,
  selectedOptions: Record<string, number>,
): number | undefined {
  if (node.requirementId == null) return undefined;
  const fromUser = selectedOptions[node.requirementId];
  if (fromUser != null) return fromUser;
  if (node.satisfiedOptionIndex != null) return node.satisfiedOptionIndex;
  return undefined;
}

/**
 * True when this node is a pure structural wrapper (conjunction / pick shell)
 * with no own requirement slot — its children can be spliced into the parent
 * after an option branch is chosen.
 */
function canHoistStructuralWrapper(node: RequirementWithStatus): boolean {
  if (node.type !== "and" && node.type !== "pick" && node.type !== "group") {
    return false;
  }
  if (node.requirementId != null) return false;
  if ((node.candidateCourses?.length ?? 0) > 0) return false;
  if ((node.creditsNeeded ?? 0) > 0) return false;
  return (node.options?.length ?? 0) > 0;
}

/**
 * Fully processes one node (option flattening + child recursion), then unwraps
 * structural `and` / `pick` / `group` shells so their children sit alongside
 * siblings from the parent list (Assign / Constrain UX).
 */
function expandSelectedOptionBranch(
  branch: RequirementWithStatus,
  selectedOptions: Record<string, number>,
): RequirementWithStatus[] {
  let nodes = mapOptionSelectionList([branch], selectedOptions);
  for (;;) {
    if (nodes.length !== 1) return nodes;
    const only = nodes[0];
    if (!canHoistStructuralWrapper(only)) return nodes;
    nodes = mapOptionSelectionList(only.options ?? [], selectedOptions);
  }
}

function mapOptionSelectionList(
  nodes: RequirementWithStatus[],
  selectedOptions: Record<string, number>,
): RequirementWithStatus[] {
  const out: RequirementWithStatus[] = [];
  for (const node of nodes) {
    const isOptionType = node.type === "or_group" || node.type === "options_group";

    if (isOptionType && node.requirementId != null) {
      const idx = selectedBranchIndexForOptionGroup(node, selectedOptions);
      const nOpts = node.options?.length ?? 0;
      if (idx != null && nOpts > 0 && idx >= 0 && idx < nOpts) {
        const child = node.options![idx];
        out.push(...expandSelectedOptionBranch(child, selectedOptions));
        continue;
      }
    }

    if (node.options?.length) {
      out.push({
        ...node,
        options: mapOptionSelectionList(node.options, selectedOptions),
      });
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * Recursively replaces `or_group` / `options_group` nodes that have a resolved
 * branch with just the selected child, at every depth. Nested groups are
 * flattened in the same pass. Selected branches that are pure `and` / `pick` /
 * `group` wrappers (no requirement id) are unwrapped so their children appear as
 * siblings of other requirements in the parent — easier to use in Assign /
 * Constrain.
 *
 * Used by AssignStep, ConstrainStep, and RequirementsStep. The Options step
 * uses the raw tree and OptionsDrilldown instead — do not pre-flatten there.
 */
export function applyOptionSelections(
  tree: RequirementWithStatus[],
  selectedOptions: Record<string, number>,
): RequirementWithStatus[] {
  return mapOptionSelectionList(tree, selectedOptions);
}

/**
 * Requirement IDs that actually render a constrain MultiSelect for this course,
 * based on the same flattened tree as ConstrainStep.
 */
export function collectRequirementIdsWithCandidateCourse(
  flattenedRoots: RequirementWithStatus[],
  courseNorm: string,
): string[] {
  const ids: string[] = [];

  function walk(nodes: RequirementWithStatus[]) {
    for (const node of nodes) {
      if (
        node.requirementId &&
        node.candidateCourses?.some((c) => normalizeCourseCode(c) === courseNorm)
      ) {
        ids.push(node.requirementId);
      }
      if (node.options?.length) {
        walk(node.options);
      }
    }
  }

  walk(flattenedRoots);
  return [...new Set(ids)];
}

export interface ResolveRequirementIdsForScheduleCourseParams {
  courseCode: string;
  courseNorm: string;
  requirementTreeWithStatus: RequirementWithStatus[];
  selectedOptionsPerRequirement: Record<string, number>;
  currentPoolMap: Record<string, string>;
  chosenCourseToRequirementId: Record<string, string>;
  remainingRequirements: RemainingRequirement[];
}

/** Requirement IDs to pin from the calendar swap modal (tree match, then pool fallback). */
export function resolveRequirementIdsForScheduleCourse(
  params: ResolveRequirementIdsForScheduleCourseParams,
): string[] {
  const {
    courseCode,
    courseNorm,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    currentPoolMap,
    chosenCourseToRequirementId,
    remainingRequirements,
  } = params;

  const flattened = applyOptionSelections(requirementTreeWithStatus, selectedOptionsPerRequirement);
  let requirementIds = collectRequirementIdsWithCandidateCourse(flattened, courseNorm);

  if (requirementIds.length === 0) {
    let poolId = currentPoolMap[courseCode] ?? chosenCourseToRequirementId[courseCode] ?? undefined;
    if (!poolId) {
      for (const req of remainingRequirements) {
        if (!req.requirementId || !req.candidateCourses?.length) continue;
        if (req.candidateCourses.some((c) => normalizeCourseCode(c) === courseNorm)) {
          poolId = req.requirementId;
          break;
        }
      }
    }
    if (poolId) requirementIds = [poolId];
  }

  return requirementIds;
}

/** Append canonical code without duplicate normalized entries. */
export function appendCourseDedupedByNorm(
  prev: string[],
  canonical: string,
  courseNorm: string,
): string[] {
  if (prev.some((c) => normalizeCourseCode(c) === courseNorm)) {
    return prev;
  }
  return [...prev, canonical];
}

/**
 * True when a course's level (its 1000s bucket) is within the selected elective
 * level buckets. Empty buckets means "no restriction". Codes without a parseable
 * 4-digit number are not filtered out.
 */
export function courseMatchesElectiveLevelBuckets(code: string, buckets: number[]): boolean {
  if (buckets.length === 0) return true;
  const match = code.match(/\d{4}/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!Number.isNaN(num)) {
      const bucket = Math.floor(num / 1000) * 1000;
      return buckets.includes(bucket);
    }
  }
  return true;
}
