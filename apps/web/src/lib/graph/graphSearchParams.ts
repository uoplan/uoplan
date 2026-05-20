import type { ProfessorGraphNode } from "@uoplan/schedule";

/** Compact professor id for graph URL (`?prof=`). Uses RMP legacy id when available. */
export function professorToSearchParam(node: ProfessorGraphNode): string {
  if (node.legacyId != null) return String(node.legacyId);
  return node.id;
}

/** Resolve `?prof=` search param to a graph node id, or null if unknown. */
export function parseProfessorSearchParam(
  raw: string | undefined,
  nodesById: Map<string, ProfessorGraphNode>,
): string | null {
  if (!raw?.trim()) return null;
  const param = decodeURIComponent(raw.trim());
  if (nodesById.has(param)) return param;
  if (/^\d+$/.test(param)) {
    const legacyId = `id:${param}`;
    if (nodesById.has(legacyId)) return legacyId;
  }
  return null;
}
