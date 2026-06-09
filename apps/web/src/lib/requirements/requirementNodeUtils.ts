import type { RequirementWithStatus } from "@uoplan/core";

export function getStableNodeKey(node: RequirementWithStatus, fallback: string): string {
  if (node.requirementId) return `req:${node.requirementId}`;
  const title = (node.title ?? "").trim();
  const code = (node.code ?? "").trim();
  return `node:${node.type}:${code}:${title}:${fallback}`;
}

export function getNodeDisplayTitle(node: RequirementWithStatus): string {
  const rawTitle = (node.title ?? "").trim();
  const fallback = rawTitle || node.code || `${node.type} requirement`;
  if (node.type === "or_group") {
    const useGenericLabel = rawTitle === "" || rawTitle.toLowerCase() === "or";
    return useGenericLabel ? "One of the following must be completed" : fallback;
  }
  return fallback;
}
