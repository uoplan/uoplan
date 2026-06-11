import { Badge, Box, Collapse, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { Fragment, type ReactNode } from "react";
import type { RequirementWithStatus } from "@uoplan/core";
import { getOptionSecondarySummaryLine } from "../../lib/requirements/requirementUtils";
import { getStableNodeKey } from "../../lib/requirements/requirementNodeUtils";
import { tr } from "../../i18n";
import { BADGE_NO_SHRINK, TITLE_FLEX, requirementIndentStyle } from "./requirementRenderPrimitives";

export function RequirementSectionHeading({ title, depth }: { title: string; depth: number }) {
  return (
    <Text fw={600} size="sm" c="dimmed" mt={depth > 0 ? "md" : 0} mb="xs">
      {title}
    </Text>
  );
}

export function CompleteBadge({ children = "Complete" }: { children?: ReactNode }) {
  return (
    <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
      {children}
    </Badge>
  );
}

export function RequirementCompleteCard({
  title,
  satisfiedBy,
  depth,
}: {
  title: string;
  satisfiedBy: string[];
  depth: number;
}) {
  return (
    <Paper
      p="sm"
      withBorder
      radius="var(--app-radius)"
      mt="xs"
      style={requirementIndentStyle(depth, "var(--app-bg)")}
    >
      <Group gap="xs" wrap="nowrap" align="center">
        <Tooltip label={title} multiline maw={320} withArrow disabled={!title}>
          <Text size="sm" c="dimmed" lineClamp={1} style={TITLE_FLEX}>
            {title}
          </Text>
        </Tooltip>
        <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
          {[...new Set(satisfiedBy)].sort().join(", ")}
        </Text>
        <CompleteBadge />
      </Group>
    </Paper>
  );
}

export function RequirementGroupTitleRow({
  label,
  complete,
  mb = 0,
  compactTitle = false,
}: {
  label: string;
  complete: boolean;
  mb?: number;
  compactTitle?: boolean;
}) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" mb={mb}>
      <Text fw={500} size="sm" lh={1.25} style={compactTitle ? { minWidth: 0 } : TITLE_FLEX}>
        {label}
      </Text>
      {complete && <CompleteBadge />}
    </Group>
  );
}

function RequirementSelectionMessages({
  showError,
  satisfiedBy,
}: {
  showError: boolean;
  satisfiedBy?: string[];
}) {
  return (
    <>
      {showError && (
        <Text size="xs" c="red" mt={4}>
          {tr("optionsDrilldown.selectOneError")}
        </Text>
      )}
      {satisfiedBy && (
        <Text size="xs" c="dimmed" mb="xs">
          {tr("requirementNode.satisfiedBy", { courses: satisfiedBy.join(", ") })}
        </Text>
      )}
    </>
  );
}

function SatisfiedOptionCoursesBadge({ courses }: { courses: string[] }) {
  return (
    <Box pl="sm" mt={4}>
      <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
        {tr("requirementNode.satisfiedBy", { courses: courses.join(", ") })}
      </Badge>
    </Box>
  );
}

function RequirementOptionChildren({
  node,
  activeBranch,
  selectedOptionIndex,
  showSummaryLine = false,
  hideCardTitle = false,
  includeSatisfiedOptionBadge = false,
  renderChild,
}: {
  node: RequirementWithStatus;
  activeBranch: boolean;
  selectedOptionIndex: number | null | undefined;
  showSummaryLine?: boolean;
  hideCardTitle?: boolean;
  includeSatisfiedOptionBadge?: boolean;
  renderChild: (
    child: RequirementWithStatus,
    index: number,
    childActiveBranch: boolean,
  ) => ReactNode;
}) {
  return (
    <Stack gap="xs">
      {node.options!.map((opt, idx) => {
        const isSatisfiedOption = node.satisfiedOptionIndex === idx && opt.complete;
        const childActiveBranch =
          activeBranch &&
          (!node.requirementId || selectedOptionIndex == null || selectedOptionIndex === idx);
        const childKey = getStableNodeKey(opt, `${getStableNodeKey(node, "parent")}:opt:${idx}`);
        const summaryLine =
          showSummaryLine && !hideCardTitle ? getOptionSecondarySummaryLine(opt) : null;

        return (
          <Box key={childKey}>
            {summaryLine && (
              <Text size="xs" c="dimmed" mb={4}>
                {summaryLine}
              </Text>
            )}
            {renderChild(opt, idx, childActiveBranch)}
            {includeSatisfiedOptionBadge && isSatisfiedOption && opt.satisfiedBy.length > 0 && (
              <SatisfiedOptionCoursesBadge courses={opt.satisfiedBy} />
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

export function RequirementChoiceGroupBody({
  titleRow,
  node,
  activeBranch,
  selectedOptionIndex,
  showError,
  satisfiedBy,
  collapseExpanded,
  showSummaryLine = false,
  hideCardTitle = false,
  includeSatisfiedOptionBadge = false,
  renderChild,
}: {
  titleRow?: ReactNode;
  node: RequirementWithStatus;
  activeBranch: boolean;
  selectedOptionIndex: number | null | undefined;
  showError: boolean;
  satisfiedBy?: string[];
  collapseExpanded?: boolean;
  showSummaryLine?: boolean;
  hideCardTitle?: boolean;
  includeSatisfiedOptionBadge?: boolean;
  renderChild: (
    child: RequirementWithStatus,
    index: number,
    childActiveBranch: boolean,
  ) => ReactNode;
}) {
  const children = (
    <RequirementOptionChildren
      node={node}
      activeBranch={activeBranch}
      selectedOptionIndex={selectedOptionIndex}
      showSummaryLine={showSummaryLine}
      hideCardTitle={hideCardTitle}
      includeSatisfiedOptionBadge={includeSatisfiedOptionBadge}
      renderChild={renderChild}
    />
  );

  return (
    <>
      {titleRow}
      <RequirementSelectionMessages showError={showError} satisfiedBy={satisfiedBy} />
      {collapseExpanded == null ? (
        children
      ) : (
        <Collapse expanded={collapseExpanded}>{children}</Collapse>
      )}
    </>
  );
}

export function RequirementChildStack({
  node,
  relation = "child",
  pl,
  renderChild,
}: {
  node: RequirementWithStatus;
  relation?: string;
  pl?: "xs";
  renderChild: (child: RequirementWithStatus, index: number) => ReactNode;
}) {
  return (
    <Stack gap="xs" pl={pl}>
      {node.options!.map((child, idx) => {
        const childKey = getStableNodeKey(
          child,
          `${getStableNodeKey(node, "parent")}:${relation}:${idx}`,
        );
        return <Fragment key={childKey}>{renderChild(child, idx)}</Fragment>;
      })}
    </Stack>
  );
}
