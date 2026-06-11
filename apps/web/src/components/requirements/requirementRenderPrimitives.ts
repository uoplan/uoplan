import type { RequirementWithStatus } from "@uoplan/core";

const REQUIREMENT_INDENT_PX = 12;
const REQUIREMENT_BASE_PADDING_PX = 10;

export const TITLE_FLEX = { flex: 1, minWidth: 0 } as const;
export const BADGE_NO_SHRINK = { flexShrink: 0 } as const;

export function getRequirementRenderMeta(node: RequirementWithStatus) {
  const hasOptions = node.options && node.options.length > 0;
  const rawTitle = (node.title ?? "").trim();
  const title = rawTitle || node.code || `${node.type} requirement`;

  return {
    hasOptions,
    rawTitle,
    title,
    isOrGroup: node.type === "or_group",
    isOptionsGroup: node.type === "options_group",
    isAnd: node.type === "and",
    isSection: node.type === "section",
    creditsNeeded: node.creditsNeeded ?? 0,
    hasRequirementId: node.requirementId != null,
  };
}

export function requirementIndentStyle(depth: number, backgroundColor: string) {
  return {
    paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
    backgroundColor,
  };
}

export function getRequirementChoiceGroupState({
  node,
  activeBranch,
  rawTitle,
  title,
  isOrGroup,
}: {
  node: RequirementWithStatus;
  activeBranch: boolean;
  rawTitle: string;
  title: string;
  isOrGroup: boolean;
}) {
  const selectedOptionIndex = node.satisfiedOptionIndex;
  const showError =
    activeBranch && node.requirementId != null && selectedOptionIndex == null && !node.complete;
  const useGenericLabel = isOrGroup && (rawTitle === "" || rawTitle.toLowerCase() === "or");
  const groupLabel = useGenericLabel ? "One of the following must be completed" : title;
  const showSatisfiedSummary = node.complete && node.satisfiedOptionIndex != null;

  return {
    selectedOptionIndex,
    showError,
    groupLabel,
    showSatisfiedSummary,
    satisfiedSummaryCourses: showSatisfiedSummary ? node.satisfiedBy : undefined,
  };
}
