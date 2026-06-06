import type { RemainingRequirement, RequirementWithStatus } from "../index";
import { canonicalGroupToken, groupTokenPrefix, isGroupToken } from "../index";

function collectRequirementsFromSelectedBranches(
  nodes: RequirementWithStatus[],
  selectedOptions: Record<string, number>,
  existingIds: Set<string>,
): RemainingRequirement[] {
  const result: RemainingRequirement[] = [];
  for (const node of nodes) {
    if (node.complete) continue;
    const isOrLike = node.type === "or_group" || node.type === "options_group";
    if (isOrLike && node.requirementId != null) {
      const sel = selectedOptions[node.requirementId];
      if (sel != null && node.options?.[sel]) {
        result.push(
          ...collectRequirementsFromSelectedBranches(
            [node.options[sel]],
            selectedOptions,
            existingIds,
          ),
        );
      }
    } else {
      if (
        node.requirementId != null &&
        !existingIds.has(node.requirementId) &&
        node.candidateCourses?.length &&
        (node.creditsNeeded ?? 0) > 0
      ) {
        existingIds.add(node.requirementId);
        result.push({
          requirementId: node.requirementId,
          type: node.type,
          title: node.title,
          candidateCourses: node.candidateCourses,
          creditsNeeded: node.creditsNeeded,
          satisfiedBy: node.satisfiedBy ?? [],
        });
      }
      if (node.options?.length) {
        result.push(
          ...collectRequirementsFromSelectedBranches(node.options, selectedOptions, existingIds),
        );
      }
    }
  }
  return result;
}

export interface ExpandConstrainedResult {
  individualSelections: Record<string, string[]>;
  groupTokenSelections: Map<string, Map<string, number>>;
}

/**
 * Build the full requirement universe the advanced generator schedules against: the base remaining
 * requirements plus any requirements reachable through currently-selected option-group branches.
 * Exported so callers (warnings UI + generation adapter) can resolve desired courses against the
 * exact same set the engine uses, avoiding misclassification of branch-only courses.
 */
export function buildEffectiveRemainingRequirements(
  remainingRequirements: RemainingRequirement[],
  requirementTreeWithStatus: RequirementWithStatus[],
  selectedOptionsPerRequirement: Record<string, number>,
): RemainingRequirement[] {
  const existingIds = new Set(
    remainingRequirements.map((r) => r.requirementId).filter((id): id is string => id != null),
  );
  const branchRequirements = collectRequirementsFromSelectedBranches(
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    existingIds,
  );
  return [...remainingRequirements, ...branchRequirements];
}

export function expandConstrainedPerRequirement(
  raw: Record<string, string[]>,
): ExpandConstrainedResult {
  const individualSelections: Record<string, string[]> = {};
  const groupTokenSelections: Map<string, Map<string, number>> = new Map();

  for (const [reqId, codes] of Object.entries(raw)) {
    const individualExpanded = new Set<string>();
    const groupTokenCountMap = new Map<string, number>();

    for (const code of codes) {
      if (isGroupToken(code)) {
        const canonical = canonicalGroupToken(code);
        const currentCount = groupTokenCountMap.get(canonical) ?? 0;
        groupTokenCountMap.set(canonical, currentCount + 1);
      } else {
        individualExpanded.add(code);
      }
    }

    if (individualExpanded.size > 0) {
      individualSelections[reqId] = [...individualExpanded];
    }

    if (groupTokenCountMap.size > 0) {
      groupTokenSelections.set(reqId, groupTokenCountMap);
    }
  }

  return { individualSelections, groupTokenSelections };
}

export function buildPendingGroupPickCounts(
  groupTokenSelections: Map<string, Map<string, number>>,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [reqId, tokenMap] of groupTokenSelections) {
    const agg = new Map<string, number>();
    for (const [canonicalToken, count] of tokenMap.entries()) {
      if (count <= 0) continue;
      const pfx = groupTokenPrefix(canonicalToken);
      agg.set(pfx, (agg.get(pfx) ?? 0) + count);
    }
    if (agg.size > 0) out.set(reqId, agg);
  }
  return out;
}
