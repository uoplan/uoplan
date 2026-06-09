/** The value shown for a subtree: the max priority among its requirement ids (default 0). */
export function priorityForIds(
  requirementIds: string[],
  priorities: Record<string, number>,
): number {
  return requirementIds.reduce((max, id) => Math.max(max, priorities[id] ?? 0), 0);
}

/** The patch applied when the control changes: stamp the chosen priority onto every id. */
export function stampPriorityForIds(
  requirementIds: string[],
  priority: number,
): Record<string, number> {
  return Object.fromEntries(requirementIds.map((id) => [id, priority]));
}
