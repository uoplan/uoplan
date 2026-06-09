import { Box, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconCheck, IconPencil } from "@tabler/icons-react";
import type { RequirementWithStatus } from "@uoplan/core";
import {
  getOptionSecondarySummaryLine,
  simplifySingleChildChain,
} from "../../lib/requirements/requirementUtils";
import { getNodeDisplayTitle, getStableNodeKey } from "../../lib/requirements/requirementNodeUtils";
import { OptionRequirementPreview } from "./OptionRequirementPreview";
import { tr } from "../../i18n";

interface OptionsDrilldownProps {
  /** Stable prefix for child RequirementNode keys and registry. */
  nodeKeyPrefix: string;
  node: RequirementWithStatus;
  completedCourses: Set<string>;
  selectedOptionsPerRequirement: Record<string, number>;
  onSelectOption: (requirementId: string, optionIndex: number) => void;
  onClearOption: (requirementId: string) => void;
  activeBranch: boolean;
  depth?: number;
}

function orGroupLabel(node: RequirementWithStatus): string {
  const rawTitle = (node.title ?? "").trim();
  const useGeneric = rawTitle === "" || rawTitle.toLowerCase() === "or";
  return useGeneric
    ? tr("optionsDrilldown.orGroupLabel.default")
    : rawTitle || node.code || tr("optionsDrilldown.chooseOne");
}

/**
 * Compact, single-level "breadcrumb" row standing in for a resolved option
 * group. Replaces the old bordered Paper + nested Box wrapper so the chosen
 * branch reads as a flat path rather than a stack of cards.
 */
function ChosenBreadcrumb({
  selectedChild,
  onClear,
}: {
  selectedChild: RequirementWithStatus;
  onClear: () => void;
}) {
  const title = getNodeDisplayTitle(selectedChild);
  const summary = getOptionSecondarySummaryLine(selectedChild);
  const backDescription = summary ?? title;
  return (
    <UnstyledButton
      type="button"
      onClick={onClear}
      aria-label={tr("optionsDrilldown.changeRequirementSetAria", { path: backDescription })}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 10px",
        borderRadius: "var(--app-radius)",
        border: "var(--app-border-width) solid var(--app-border)",
        backgroundColor: "var(--app-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "var(--app-transition)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--app-surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--app-surface)";
      }}
    >
      <Group gap="xs" wrap="nowrap" align="center">
        <IconCheck size={16} aria-hidden style={{ flexShrink: 0, color: "var(--app-success)" }} />
        <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" c="var(--app-text-muted)" lh={1.2}>
            {tr("optionsDrilldown.chosenLabel")}
          </Text>
          <Text size="sm" lh={1.3} c="var(--app-text)" lineClamp={2} style={{ minWidth: 0 }}>
            {title}
            {summary ? <Text span c="var(--app-text-muted)">{` · ${summary}`}</Text> : null}
          </Text>
        </Stack>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0, color: "var(--app-accent)" }}>
          <IconPencil size={14} aria-hidden />
          <Text size="xs" fw={500} c="var(--app-accent)">
            {tr("optionsDrilldown.change")}
          </Text>
        </Group>
      </Group>
    </UnstyledButton>
  );
}

export function OptionsDrilldown({
  nodeKeyPrefix,
  node: rawNode,
  completedCourses,
  selectedOptionsPerRequirement,
  onSelectOption,
  onClearOption,
  activeBranch,
  depth = 0,
}: OptionsDrilldownProps) {
  const { node } = simplifySingleChildChain(rawNode);

  if (node.type === "section") {
    return <OptionRequirementPreview node={node} activeBranch={activeBranch} depth={depth} />;
  }

  const isOptionGroup =
    (node.type === "or_group" || node.type === "options_group") &&
    node.requirementId != null &&
    !node.complete &&
    (node.options?.length ?? 0) > 0;

  if (isOptionGroup) {
    const reqId = node.requirementId!;
    const options = node.options!;
    const selectedIdx = selectedOptionsPerRequirement[reqId];
    const selOk = selectedIdx != null && selectedIdx >= 0 && selectedIdx < options.length;
    const selectedChild = selOk ? options[selectedIdx] : null;

    const showError = activeBranch && !selOk && !node.complete;

    if (!selOk) {
      return (
        <Box
          role="radiogroup"
          aria-label={node.type === "or_group" ? orGroupLabel(node) : undefined}
          data-missing-selection={showError ? "true" : undefined}
        >
          {node.type === "or_group" && (
            <Text size="sm" c="var(--app-text-muted)" mb="xs">
              {orGroupLabel(node)}
            </Text>
          )}
          {showError && (
            <Text size="xs" c="var(--app-danger)" mb="xs">
              {tr("optionsDrilldown.selectOneError")}
            </Text>
          )}
          <Stack gap="xs">
            {options.map((opt, idx) => {
              const childKey = getStableNodeKey(opt, `${nodeKeyPrefix}:pick:${idx}`);
              const isSelected = selectedIdx === idx;
              const childActiveBranch =
                activeBranch && (selectedIdx == null || selectedIdx === idx);
              return (
                <OptionRequirementPreview
                  key={childKey}
                  node={opt}
                  radio={{
                    checked: isSelected,
                    onChange: () => onSelectOption(reqId, idx),
                    name: reqId,
                    value: String(idx),
                  }}
                  activeBranch={childActiveBranch}
                  depth={0}
                  optionsStepHideCardTitle
                  optionsStepOptionOrdinal={idx + 1}
                />
              );
            })}
          </Stack>
        </Box>
      );
    }

    // Resolved: flat breadcrumb row + the chosen branch rendered inline along a
    // subtle left rail (no nested card) so ownership stays clear.
    return (
      <Stack gap="xs">
        <ChosenBreadcrumb selectedChild={selectedChild!} onClear={() => onClearOption(reqId)} />
        <Box pl="sm" style={{ borderLeft: "var(--app-border-width) solid var(--app-border)" }}>
          <OptionsDrilldown
            nodeKeyPrefix={getStableNodeKey(selectedChild!, `${nodeKeyPrefix}:in:${selectedIdx}`)}
            node={selectedChild!}
            completedCourses={completedCourses}
            selectedOptionsPerRequirement={selectedOptionsPerRequirement}
            onSelectOption={onSelectOption}
            onClearOption={onClearOption}
            activeBranch={activeBranch}
            depth={depth + 1}
          />
        </Box>
      </Stack>
    );
  }

  if (node.type === "and" && node.options?.length) {
    return (
      <Stack gap="xs">
        {node.options.map((child, idx) => {
          const childPrefix = getStableNodeKey(child, `${nodeKeyPrefix}:and:${idx}`);
          return (
            <OptionsDrilldown
              key={childPrefix}
              nodeKeyPrefix={childPrefix}
              node={child}
              completedCourses={completedCourses}
              selectedOptionsPerRequirement={selectedOptionsPerRequirement}
              onSelectOption={onSelectOption}
              onClearOption={onClearOption}
              activeBranch={activeBranch}
              depth={depth}
            />
          );
        })}
      </Stack>
    );
  }

  return <OptionRequirementPreview node={node} activeBranch={activeBranch} depth={depth} />;
}
