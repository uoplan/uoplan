import { useState, useMemo, memo, type KeyboardEvent, type ReactNode } from "react";
import { Stack, Text, Paper, Badge, Group, Collapse, Tooltip, UnstyledButton } from "@mantine/core";
import { IconCheck, IconChevronDown, IconX, IconChartCohort } from "@tabler/icons-react";
import type { ComboboxItem } from "@mantine/core";
import type { DataCache } from "@uoplan/core";
import {
  normalizeCourseCode,
  isGroupToken,
  groupTokenPrefix,
  canonicalGroupToken,
  makeGroupTokenInstance,
} from "@uoplan/core";
import type { RequirementWithStatus } from "@uoplan/core";
import {
  getConstrainMultiSelectOptions,
  simplifySingleChildChain,
} from "../../lib/requirements/requirementUtils";
import { VirtualizedMultiSelect } from "../shared/VirtualizedMultiSelect";
import { tr } from "../../i18n";
import {
  CompleteBadge,
  RequirementChildStack,
  RequirementChoiceGroupBody,
  RequirementCompleteCard,
  RequirementSectionHeading,
} from "./requirementRenderUtils";
import {
  BADGE_NO_SHRINK,
  TITLE_FLEX,
  getRequirementChoiceGroupState,
  getRequirementRenderMeta,
  requirementIndentStyle,
} from "./requirementRenderPrimitives";

function handleKeyboardToggle(e: KeyboardEvent<HTMLElement>, toggle: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggle();
  }
}

function getSelectedCredits(cache: DataCache | null, courseCodes: string[]): number {
  if (!cache) return 0;
  return courseCodes.reduce((sum, code) => sum + (cache.getCourse(code)?.credits ?? 3), 0);
}

function CollapsibleRequirementHeader({
  label,
  opened,
  onToggle,
  showComplete,
  headerAccessory,
}: {
  label: string;
  opened: boolean;
  onToggle: (e?: { stopPropagation: () => void }) => void;
  showComplete: boolean;
  headerAccessory?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" mb={0}>
      <UnstyledButton
        onClick={onToggle}
        aria-expanded={opened}
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
      >
        <Group gap="xs" align="center" style={TITLE_FLEX}>
          <IconChevronDown
            size={14}
            style={{
              flexShrink: 0,
              transform: opened ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "var(--app-transition)",
            }}
          />
          <Text fw={500} size="sm" lh={1.25} style={{ minWidth: 0 }}>
            {label}
          </Text>
        </Group>
      </UnstyledButton>
      <Stack gap={4} align="flex-end" style={BADGE_NO_SHRINK}>
        {showComplete && <CompleteBadge />}
        {headerAccessory}
      </Stack>
    </Group>
  );
}

interface RequirementNodeProps {
  node: RequirementWithStatus;
  cache: DataCache | null;
  completedCourses: Set<string>;
  selectedPerRequirement: Record<string, string[]>;
  /** Constrain-step selections, used to exempt explicit courses from virtual-only filtering. */
  constrainedPerRequirement?: Record<string, string[]>;
  onSelect: (requirementId: string, courses: string[]) => void;
  activeBranch: boolean;
  depth?: number;
  prereqEligible: Set<string>;
  levelBuckets: ("undergrad" | "grad")[];
  languageBuckets: ("en" | "fr" | "other")[];
  electiveLevelBuckets: number[];
  /** Course codes that are completed but not yet assigned to any requirement; show first in dropdown with checkmark. */
  unassignedCompletedSet: Set<string>;
  /** Normalized form of unassigned completed (for dedupe/checkmark when option value is canonical). */
  unassignedCompletedSetNormalized: Set<string>;
  /** Normalized course codes already assigned to any requirement (auto-matched or user-selected). */
  allAssignedCoursesNormalized: Set<string>;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  /** When true, restrict the dropdown to only courses in completedCourses (Assign step). */
  completedOnly?: boolean;
  /** Optional element rendered on the right side of the card header (e.g. a priority control). */
  headerAccessory?: ReactNode;
}

export const RequirementNode = memo(
  function RequirementNode({
    node: rawNode,
    cache,
    completedCourses,
    selectedPerRequirement,
    constrainedPerRequirement,
    onSelect,
    activeBranch,
    depth = 0,
    prereqEligible,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    unassignedCompletedSet,
    unassignedCompletedSetNormalized,
    allAssignedCoursesNormalized,
    includeClosedComponents,
    virtualSectionsOnly,
    completedOnly = false,
    headerAccessory,
  }: RequirementNodeProps) {
    const { node, autoExpanded } = simplifySingleChildChain(rawNode);

    const {
      hasOptions,
      rawTitle,
      title,
      isOrGroup,
      isOptionsGroup,
      isAnd,
      isSection,
      creditsNeeded,
      hasRequirementId,
    } = getRequirementRenderMeta(node);
    const hasNiceTitle = rawTitle.length > 0;
    const hasCode = !!node.code;
    const hasCreditsInfo = creditsNeeded > 0;
    const hasSatisfiedInfo = node.complete && node.satisfiedBy.length > 0;
    const hasSummary = hasNiceTitle || hasCode || hasCreditsInfo || hasSatisfiedInfo;

    const [opened, setOpened] = useState(() => depth === 0 && (autoExpanded || !hasSummary));

    const collapseIn = opened;

    const toggleLocal = (e?: { stopPropagation: () => void }) => {
      e?.stopPropagation();
      if (!hasOptions) return;
      setOpened((o) => !o);
    };

    const selected = node.requirementId ? (selectedPerRequirement[node.requirementId] ?? []) : [];
    const selectedCreditsForComplete = getSelectedCredits(cache, selected);
    const satisfiedBySelection =
      node.requirementId != null &&
      creditsNeeded > 0 &&
      selectedCreditsForComplete >= creditsNeeded;
    const allSelectedTaken = selected.length > 0 && selected.every((c) => completedCourses.has(c));
    const showAsComplete = (node.complete && node.satisfiedBy.length > 0) || satisfiedBySelection;
    const { selectedForDisplay, options } = useMemo(() => {
      const { selectedForDisplay, options } = getConstrainMultiSelectOptions(
        node,
        selectedPerRequirement,
        {
          cache,
          completedCourses,
          prereqEligible,
          levelBuckets,
          languageBuckets,
          electiveLevelBuckets,
          unassignedCompletedSetNormalized,
          allAssignedCoursesNormalized,
          includeClosedComponents,
          virtualSectionsOnly,
          constrainedPerRequirement,
          completedOnly,
        },
      );

      // Re-sort: groups first when matching same prefix, otherwise alphabetical by course code
      // (use value for courses so titles in label do not reorder the list)
      options.sort((a, b) => {
        const getDisplayStr = (item: ComboboxItem) =>
          isGroupToken(item.value) ? groupTokenPrefix(item.value) : item.value;

        const aDisplay = getDisplayStr(a);
        const bDisplay = getDisplayStr(b);

        return aDisplay.localeCompare(bDisplay);
      });

      return { selectedForDisplay, options };
    }, [
      node,
      prereqEligible,
      levelBuckets,
      languageBuckets,
      electiveLevelBuckets,
      cache,
      completedCourses,
      unassignedCompletedSetNormalized,
      allAssignedCoursesNormalized,
      includeClosedComponents,
      virtualSectionsOnly,
      completedOnly,
      selectedPerRequirement,
      constrainedPerRequirement,
    ]);

    if (isSection) {
      return <RequirementSectionHeading title={title} depth={depth} />;
    }

    const selectedCredits = getSelectedCredits(cache, selectedForDisplay);
    const satisfiedByDisplay = [...(node.satisfiedBy ?? []), ...selectedForDisplay].filter(Boolean);
    const satisfiedByDisplayUnique = [...new Set(satisfiedByDisplay)];
    const creditsRemaining = Math.max(0, creditsNeeded - selectedCredits);
    const isOverSelected = creditsNeeded > 0 && selectedCredits > creditsNeeded;

    const multiSelectBlock = hasRequirementId ? (
      <Stack gap="xs" mt="xs">
        {satisfiedByDisplayUnique.length > 0 && (
          <Text size="xs" c="dimmed">
            {tr("requirementNode.satisfiedBy", {
              courses: satisfiedByDisplayUnique.sort().join(", "),
            })}
          </Text>
        )}
        {creditsNeeded > 0 && (
          <Text size="xs" c={isOverSelected ? "yellow" : "dimmed"}>
            {isOverSelected
              ? tr("requirementNode.overSelected", {
                  selectedCredits,
                  creditsNeeded,
                  suffix: creditsNeeded !== 1 ? "s" : "",
                })
              : selectedCredits > 0
                ? tr("requirementNode.progress", {
                    selectedCredits,
                    creditsNeeded,
                    nextAction:
                      creditsRemaining > 0
                        ? tr("requirementNode.pickMore", {
                            count: Math.ceil(creditsRemaining / 3),
                            suffix: Math.ceil(creditsRemaining / 3) !== 1 ? "s" : "",
                          })
                        : tr("requirementNode.satisfied"),
                  })
                : tr("requirementNode.selectToFulfill", {
                    creditsRemaining,
                    suffix: creditsRemaining !== 1 ? "s" : "",
                  })}
          </Text>
        )}
        <VirtualizedMultiSelect
          label={tr("requirementNode.coursesLabel")}
          placeholder={tr("requirementNode.searchPlaceholder")}
          data={options}
          value={selectedForDisplay}
          hidePickedOptions
          onChange={(courses) => {
            const withInstances = courses.map((c) =>
              isGroupToken(c) && c === canonicalGroupToken(c)
                ? makeGroupTokenInstance(groupTokenPrefix(c))
                : c,
            );
            onSelect(node.requirementId!, withInstances);
          }}
          onClick={(e) => e.stopPropagation()}
          clearable
          clearAriaLabel={tr("requirementNode.clearAll")}
          getRemoveAriaLabel={(course) => tr("requirementNode.removeCourse", { course })}
          renderOption={({ option }) => {
            if (isGroupToken(option.value)) {
              return (
                <Group gap="xs" wrap="nowrap" align="center">
                  <Text span size="sm">
                    {option.label}
                  </Text>
                  <IconChartCohort size={12} color="var(--mantine-color-gray-4)" />
                </Group>
              );
            }
            const course = cache?.getCourse(normalizeCourseCode(option.value));
            const label = course?.title ? `${option.value} – ${course.title}` : option.label;
            const isSelected = selectedForDisplay.includes(option.value);
            const isCompleted = unassignedCompletedSetNormalized.has(
              normalizeCourseCode(option.value),
            );
            const isUsedElsewhere = (option as { disabled?: boolean }).disabled === true;
            if (isUsedElsewhere) {
              return (
                <Group gap="xs" wrap="nowrap">
                  <Badge size="xs" color="gray" variant="light" style={BADGE_NO_SHRINK}>
                    USED
                  </Badge>
                  <Text span size="sm" c="dimmed">
                    {label}
                  </Text>
                </Group>
              );
            }
            if (isSelected) {
              return (
                <Group gap="xs" wrap="nowrap">
                  <IconX size={14} color="var(--mantine-color-red-6)" />
                  <Text span size="sm">
                    {label}
                  </Text>
                </Group>
              );
            }
            if (isCompleted) {
              return (
                <Group gap="xs" wrap="nowrap">
                  <IconCheck size={14} color="var(--mantine-color-green-6)" />
                  <Text span size="sm">
                    {label}
                  </Text>
                </Group>
              );
            }
            return label;
          }}
          filter={({ options: opts, search }) => {
            const q = search.toLowerCase().trim();
            if (!q) return opts;
            return (opts as ComboboxItem[]).filter((o) => {
              const title = isGroupToken(o.value)
                ? ""
                : (cache?.getCourse(normalizeCourseCode(o.value))?.title ?? "");
              return (
                o.value.toLowerCase().includes(q) ||
                o.label.toLowerCase().includes(q) ||
                title.toLowerCase().includes(q)
              );
            });
          }}
          nothingFoundMessage={tr("requirementNode.noCoursesFound")}
        />
      </Stack>
    ) : null;

    const renderChildNode = (child: RequirementWithStatus, childActiveBranch: boolean) => (
      <RequirementNode
        node={child}
        cache={cache}
        completedCourses={completedCourses}
        selectedPerRequirement={selectedPerRequirement}
        onSelect={onSelect}
        activeBranch={childActiveBranch}
        depth={depth + 1}
        prereqEligible={prereqEligible}
        levelBuckets={levelBuckets}
        languageBuckets={languageBuckets}
        electiveLevelBuckets={electiveLevelBuckets}
        unassignedCompletedSet={unassignedCompletedSet}
        unassignedCompletedSetNormalized={unassignedCompletedSetNormalized}
        allAssignedCoursesNormalized={allAssignedCoursesNormalized}
        includeClosedComponents={includeClosedComponents}
        virtualSectionsOnly={virtualSectionsOnly}
        completedOnly={completedOnly}
      />
    );

    // Only show compact read-only "Complete" card for tree-matched leaves (no requirementId, no dropdown).
    if (node.complete && node.satisfiedBy.length > 0 && !hasOptions) {
      return (
        <RequirementCompleteCard
          title={title}
          satisfiedBy={satisfiedByDisplayUnique}
          depth={depth}
        />
      );
    }

    if ((isOrGroup || isOptionsGroup) && hasOptions) {
      const {
        selectedOptionIndex,
        showError,
        groupLabel,
        showSatisfiedSummary,
        satisfiedSummaryCourses,
      } = getRequirementChoiceGroupState({
        node,
        activeBranch,
        rawTitle,
        title,
        isOrGroup,
      });

      const optionGroupBody = (
        <RequirementChoiceGroupBody
          node={node}
          activeBranch={activeBranch}
          selectedOptionIndex={selectedOptionIndex}
          showError={showError}
          satisfiedBy={satisfiedSummaryCourses}
          collapseExpanded={collapseIn}
          includeSatisfiedOptionBadge={isOrGroup}
          renderChild={(opt, _idx, childActiveBranch) => renderChildNode(opt, childActiveBranch)}
        />
      );

      return (
        <Paper
          p="sm"
          withBorder
          radius="var(--app-radius)"
          mt="xs"
          data-missing-selection={showError ? "true" : undefined}
          style={requirementIndentStyle(
            depth,
            opened ? "var(--app-surface)" : "var(--app-surface-sunken)",
          )}
        >
          <CollapsibleRequirementHeader
            label={groupLabel}
            opened={opened}
            onToggle={toggleLocal}
            showComplete={isOrGroup ? showSatisfiedSummary : node.complete}
            headerAccessory={headerAccessory}
          />
          {optionGroupBody}
        </Paper>
      );
    }

    if (isAnd && hasOptions) {
      const andCollapse = (
        <Collapse expanded={collapseIn}>
          <RequirementChildStack
            node={node}
            renderChild={(child) => renderChildNode(child, activeBranch)}
          />
        </Collapse>
      );

      return (
        <Paper
          p="sm"
          withBorder
          radius="var(--app-radius)"
          mt="xs"
          style={requirementIndentStyle(
            depth,
            opened ? "var(--app-surface)" : "var(--app-surface-sunken)",
          )}
        >
          {title && (
            <CollapsibleRequirementHeader
              label={title}
              opened={opened}
              onToggle={toggleLocal}
              showComplete={node.complete}
              headerAccessory={headerAccessory}
            />
          )}
          {andCollapse}
        </Paper>
      );
    }

    const label =
      creditsNeeded > 0 && !showAsComplete
        ? `${title} (${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""} needed)`
        : title;

    const leafPickCollapse =
      hasOptions && (node.type === "pick" || node.type === "group") ? (
        <Collapse expanded={collapseIn}>
          <RequirementChildStack
            node={node}
            pl="xs"
            renderChild={(child) => renderChildNode(child, activeBranch)}
          />
        </Collapse>
      ) : null;

    const leafBadgeRow =
      satisfiedBySelection && allSelectedTaken ? (
        <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
          Complete
        </Badge>
      ) : satisfiedBySelection ? (
        <Badge color="teal" variant="light" size="sm" style={BADGE_NO_SHRINK}>
          Satisfied
        </Badge>
      ) : hasRequirementId && creditsRemaining > 0 ? (
        <Badge color="blue" variant="light" size="sm" style={BADGE_NO_SHRINK}>
          {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} needed
        </Badge>
      ) : null;

    const defaultPaperBg = hasOptions
      ? opened
        ? "var(--app-surface)"
        : "var(--app-surface-sunken)"
      : "var(--app-bg)";

    return (
      <Paper
        p="sm"
        withBorder
        radius="var(--app-radius)"
        mt="xs"
        style={requirementIndentStyle(depth, defaultPaperBg)}
      >
        <Stack gap="xs">
          <Group
            justify="space-between"
            wrap="nowrap"
            align="flex-start"
            onClick={hasOptions ? toggleLocal : undefined}
            onKeyDown={hasOptions ? (e) => handleKeyboardToggle(e, toggleLocal) : undefined}
            role={hasOptions ? "button" : undefined}
            tabIndex={hasOptions ? 0 : undefined}
            aria-expanded={hasOptions ? opened : undefined}
            style={hasOptions ? { cursor: "pointer" } : undefined}
          >
            <Group gap="xs" align="flex-start" style={TITLE_FLEX}>
              {hasOptions && (
                <IconChevronDown
                  size={16}
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    transform: opened ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "var(--app-transition)",
                  }}
                />
              )}
              <Tooltip label={label} multiline maw={320} withArrow disabled={!label}>
                <Text fw={500} size="sm" lh={1.3} lineClamp={2} style={{ minWidth: 0 }}>
                  {label}
                </Text>
              </Tooltip>
            </Group>
            <Stack gap={4} align="flex-end" style={BADGE_NO_SHRINK}>
              {leafBadgeRow}
              {headerAccessory}
            </Stack>
          </Group>
          {multiSelectBlock}
          {leafPickCollapse}
        </Stack>
      </Paper>
    );
  },
  function areEqual(prevProps, nextProps) {
    if (prevProps.activeBranch !== nextProps.activeBranch) return false;
    if (prevProps.depth !== nextProps.depth) return false;
    if (prevProps.includeClosedComponents !== nextProps.includeClosedComponents) return false;
    if (prevProps.virtualSectionsOnly !== nextProps.virtualSectionsOnly) return false;

    if (prevProps.node !== nextProps.node) return false;

    // We can optimize global map checks by seeing if this specific node's requirementId changed.
    // We check subtree reqIds in the tree.
    const reqId = nextProps.node.requirementId;

    if (reqId) {
      if (prevProps.selectedPerRequirement[reqId] !== nextProps.selectedPerRequirement[reqId])
        return false;
      if (
        prevProps.constrainedPerRequirement?.[reqId] !==
        nextProps.constrainedPerRequirement?.[reqId]
      )
        return false;
    }

    // Check object references that don't change very often
    if (prevProps.completedCourses !== nextProps.completedCourses) return false;
    if (prevProps.unassignedCompletedSet !== nextProps.unassignedCompletedSet) return false;
    if (prevProps.unassignedCompletedSetNormalized !== nextProps.unassignedCompletedSetNormalized)
      return false;
    if (prevProps.allAssignedCoursesNormalized !== nextProps.allAssignedCoursesNormalized)
      return false;
    if (prevProps.prereqEligible !== nextProps.prereqEligible) return false;
    if (prevProps.levelBuckets !== nextProps.levelBuckets) return false;
    if (prevProps.languageBuckets !== nextProps.languageBuckets) return false;
    if (prevProps.electiveLevelBuckets !== nextProps.electiveLevelBuckets) return false;

    // If this node is NOT a leaf, we MUST ensure we re-render if any of its descendants' requirementIds
    // have changed in the Maps. A simple trick: if it's a leaf, we can return true!
    // If it's a parent, it's safer to just check Map reference equality, as the parent needs to
    // pass down the fresh maps. Actually, React will skip the parent but re-render the child
    // ONLY if the parent didn't re-render. But the child gets its props FROM the parent!
    // Wait, if parent is memo'd and skips render, children do NOT get new props.
    // So we MUST re-render the parent if ANY child needs to re-render.
    // To avoid this, we should NOT check subtree equality, but instead we just return false
    // if the map reference changed and the node has children.

    const hasChildren = nextProps.node.options && nextProps.node.options.length > 0;
    if (hasChildren) {
      if (prevProps.selectedPerRequirement !== nextProps.selectedPerRequirement) return false;
      if (prevProps.constrainedPerRequirement !== nextProps.constrainedPerRequirement) return false;
    }

    return true;
  },
);
