import { useState } from "react";
import { ActionIcon, Box, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconCheck, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { RequirementWithStatus } from "@uoplan/core";
import { getStableNodeKey } from "../../lib/requirements/requirementNodeUtils";
import { OptionsDrilldown } from "./OptionsDrilldown";
import {
  hasMissingOptionSelections,
  nodeHasOptionGroups,
} from "../../lib/requirements/requirementUtils";
import { tr, useTr } from "../../i18n";

const PAGER_INCOMPLETE_ID = "optionsStep.pager.incomplete";
const PAGER_COMPLETE_ID = "optionsStep.pager.complete";
const PAGER_GOTO_WITH_STATUS_ID = "optionsStep.pager.goToWithStatus";

interface OptionsStepProps {
  requirementTreeWithStatus: RequirementWithStatus[];
  completedCourses: string[];
  selectedOptionsPerRequirement: Record<string, number>;
  onSelectOption: (requirementId: string, optionIndex: number) => void;
  onClearOption: (requirementId: string) => void;
}

export function OptionsStep({
  requirementTreeWithStatus,
  completedCourses,
  selectedOptionsPerRequirement,
  onSelectOption,
  onClearOption,
}: OptionsStepProps) {
  useTr();
  const completedCoursesSet = new Set(completedCourses);

  // Only show top-level nodes that contain (or are) option groups needing selection.
  const relevantNodes = requirementTreeWithStatus.filter(nodeHasOptionGroups);
  const pages = relevantNodes.map((node, idx) => ({
    node,
    key: getStableNodeKey(node, `options:${idx}`),
    incomplete: hasMissingOptionSelections([node], selectedOptionsPerRequirement),
  }));

  // Track the active page by stable key so selections (which can reorder/resize
  // `relevantNodes`) don't jump the user to a different requirement set. When the
  // active page resolves and drops out, fall back to the first incomplete page.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const fallbackPage = pages.find((p) => p.incomplete) ?? pages[0];
  const activePage = pages.find((p) => p.key === activeKey) ?? fallbackPage;
  const activeIndex = activePage ? pages.indexOf(activePage) : 0;

  if (pages.length === 0) {
    return (
      <Box
        data-tour="options"
        p="md"
        style={{
          backgroundColor: "var(--app-info-soft)",
          border: "var(--app-border-width) solid var(--app-border)",
          borderRadius: "var(--app-radius)",
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <IconCheck size={18} style={{ color: "var(--app-success)", flexShrink: 0 }} aria-hidden />
          <Text size="sm" c="var(--app-text)">
            {tr("optionsStep.none")}
          </Text>
        </Group>
      </Box>
    );
  }

  const multi = pages.length > 1;
  const active = activePage!;

  return (
    <Stack gap="md" data-tour="options">
      <Text size="sm" c="var(--app-text-muted)">
        {tr("optionsStep.note")}
      </Text>

      {multi && (
        <Group justify="space-between" align="center" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="var(--app-radius)"
            disabled={activeIndex === 0}
            onClick={() => setActiveKey(pages[activeIndex - 1].key)}
            aria-label={tr("optionsStep.pager.prev")}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>

          <Stack gap={4} align="center" style={{ minWidth: 0 }}>
            <Text size="xs" fw={600} c="var(--app-text)">
              {tr("optionsStep.pager.position", {
                current: activeIndex + 1,
                total: pages.length,
              })}
            </Text>
            <Group gap={6} justify="center" wrap="wrap">
              {pages.map((p, idx) => {
                const isActive = idx === activeIndex;
                const status = p.incomplete ? tr(PAGER_INCOMPLETE_ID) : tr(PAGER_COMPLETE_ID);
                const color = p.incomplete ? "var(--app-warning)" : "var(--app-success)";
                return (
                  <UnstyledButton
                    key={p.key}
                    onClick={() => setActiveKey(p.key)}
                    aria-label={tr(PAGER_GOTO_WITH_STATUS_ID, {
                      number: idx + 1,
                      total: pages.length,
                      status,
                    })}
                    aria-current={isActive ? "step" : undefined}
                    style={{
                      width: isActive ? 22 : 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: color,
                      opacity: isActive ? 1 : 0.45,
                      transition: "var(--app-transition)",
                    }}
                  />
                );
              })}
            </Group>
          </Stack>

          <ActionIcon
            variant="subtle"
            color="gray"
            radius="var(--app-radius)"
            disabled={activeIndex === pages.length - 1}
            onClick={() => setActiveKey(pages[activeIndex + 1].key)}
            aria-label={tr("optionsStep.pager.next")}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      )}

      <OptionsDrilldown
        key={active.key}
        nodeKeyPrefix={active.key}
        node={active.node}
        completedCourses={completedCoursesSet}
        selectedOptionsPerRequirement={selectedOptionsPerRequirement}
        onSelectOption={onSelectOption}
        onClearOption={onClearOption}
        activeBranch={true}
        depth={0}
      />
    </Stack>
  );
}
