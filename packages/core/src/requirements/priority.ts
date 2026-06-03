import type { RemainingRequirement, RequirementWithStatus } from "./types";

/**
 * Collect every requirementId in a node's subtree (the node itself plus all of its
 * option descendants). Used to "stamp" a user-chosen priority onto an entire group:
 * setting a group's priority assigns that value to all of the pools beneath it.
 */
export function collectRequirementIds(node: RequirementWithStatus): string[] {
  const out: string[] = [];
  const walk = (n: RequirementWithStatus): void => {
    if (n.requirementId) out.push(n.requirementId);
    if (n.options) for (const child of n.options) walk(child);
  };
  walk(node);
  return out;
}

/**
 * Strict priority-tier gate. Each remaining requirement has an effective priority
 * (default `0`) looked up by requirementId. Only the pools at the lowest priority
 * tier currently present are returned — a higher tier is withheld until every
 * lower-priority requirement has been satisfied (and thus dropped from `remaining`).
 *
 * When no priorities are set (all `0`/absent) this is a no-op and returns the input
 * array unchanged, preserving the default generation behaviour.
 */
export function gateRemainingByPriority(
  remaining: RemainingRequirement[],
  priorities: Record<string, number>,
): RemainingRequirement[] {
  if (remaining.length === 0) return remaining;
  const priorityOf = (r: RemainingRequirement): number => priorities[r.requirementId] ?? 0;

  let minTier = Infinity;
  let anyNonZero = false;
  for (const r of remaining) {
    const p = priorityOf(r);
    if (p < minTier) minTier = p;
    if (p !== 0) anyNonZero = true;
  }
  if (!anyNonZero) return remaining;
  return remaining.filter((r) => priorityOf(r) === minTier);
}
