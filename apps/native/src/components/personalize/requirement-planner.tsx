import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";
import type { RemainingRequirement, RequirementWithStatus } from "@uoplan/core/requirements";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { AppIcon } from "@/components/app-icon";
import { PersonalizeRequirementsReadoutView } from "@/components/personalize-requirements-readout";
import { Spacing, Surface } from "@/constants/theme";
import {
  clearSelectedOptionForRequirement,
  getRequirementPriorityForIds,
  requirementIdsForNode,
  setCoursesThisSemester,
  setRequirementPriorityForIds,
  setSelectedOptionForRequirement,
  toggleRequirementCourse,
  type PersonalizeRequirementSelections,
  type PersonalizeRequirementsReadout,
} from "@/lib/personalize-requirements";

const MAX_CANDIDATES_PER_REQUIREMENT = 12;
const PRIORITIES = [0, 1, 2, 3] as const;

interface RequirementPlannerProps {
  readout: PersonalizeRequirementsReadout;
  selections: PersonalizeRequirementSelections;
  completedCourses: readonly string[];
  titleForCourse: (code: string) => string | undefined;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}

function requirementLabel(type: string): string {
  switch (type) {
    case "discipline_elective":
      return "Discipline elective";
    case "faculty_elective":
      return "Faculty elective";
    case "credit_count":
      return "Course units";
    case "or_group":
    case "or_course":
      return "Choose one";
    default:
      return "Requirement";
  }
}

function remainingSubtitle(req: RemainingRequirement): string {
  const parts: string[] = [];
  if (req.creditsNeeded != null && req.creditsNeeded > 0) {
    parts.push(`${req.creditsNeeded} credit${req.creditsNeeded === 1 ? "" : "s"} needed`);
  }
  if (req.satisfiedBy.length > 0) {
    parts.push(`${req.satisfiedBy.length} completed so far`);
  }
  if (parts.length === 0 && req.candidateCourses.length > 0) {
    parts.push(
      `${req.candidateCourses.length} eligible course${req.candidateCourses.length === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" · ");
}

function nodeHasOptionGroups(node: RequirementWithStatus): boolean {
  if (node.complete) return false;
  if ((node.type === "or_group" || node.type === "options_group") && node.requirementId) {
    return true;
  }
  return node.options?.some(nodeHasOptionGroups) ?? false;
}

function optionTitle(node: RequirementWithStatus, index: number): string {
  return node.title ?? node.code ?? `Option ${index + 1}`;
}

function optionSummary(node: RequirementWithStatus): string {
  const parts: string[] = [];
  if (node.creditsNeeded != null && node.creditsNeeded > 0) {
    parts.push(`${node.creditsNeeded} credit${node.creditsNeeded === 1 ? "" : "s"}`);
  }
  const candidates = node.candidateCourses?.length ?? 0;
  if (candidates > 0) {
    parts.push(`${candidates} course${candidates === 1 ? "" : "s"}`);
  }
  if (nodeHasOptionGroups(node)) parts.push("More choices");
  return parts.join(" · ");
}

function compactCourseSet(record: Record<string, string[]>, requirementId: string): Set<string> {
  return new Set((record[requirementId] ?? []).map((code) => normalizeCourseCode(code)));
}

function SelectionChip({
  label,
  icon,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: "checkmark" | "pin" | "flag";
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        disabled ? styles.chipDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <AppIcon
        name={icon}
        size={12}
        color={selected ? Surface.onAccent : Surface.dimmed}
        weight="semibold"
      />
      <Text size="xs" weight="bold" color={selected ? Surface.onAccent : Surface.label}>
        {label}
      </Text>
    </Pressable>
  );
}

function PriorityPicker({
  requirementIds,
  selections,
  onChange,
}: {
  requirementIds: readonly string[];
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  if (requirementIds.length === 0) return null;
  const current = getRequirementPriorityForIds(selections, requirementIds);
  return (
    <View style={styles.priorityRow}>
      <Text size="xs" dimmed>
        Priority
      </Text>
      <View style={styles.priorityChips}>
        {PRIORITIES.map((priority) => {
          const selected = current === priority;
          return (
            <Pressable
              key={priority}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Priority ${priority}`}
              onPress={() =>
                onChange(setRequirementPriorityForIds(selections, requirementIds, priority))
              }
              style={({ pressed }) => [
                styles.priorityChip,
                selected ? styles.priorityChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text size="xs" weight="bold" color={selected ? Surface.onAccent : Surface.label}>
                {priority}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CoursesThisSemesterControl({
  selections,
  onChange,
}: {
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  const count = selections.coursesThisSemester;
  return (
    <View style={styles.loadControl}>
      <View style={styles.loadCopy}>
        <Text size="sm" weight="bold">
          Courses to schedule
        </Text>
        <Text size="xs" dimmed>
          Advanced generation fills this many courses from pinned picks and remaining requirements.
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schedule fewer courses"
          onPress={() => onChange(setCoursesThisSemester(selections, count - 1))}
          style={styles.stepperButton}
        >
          <AppIcon name="minus" size={14} color={Surface.label} weight="semibold" />
        </Pressable>
        <Text size="md" weight="bold">
          {count}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schedule more courses"
          onPress={() => onChange(setCoursesThisSemester(selections, count + 1))}
          style={styles.stepperButton}
        >
          <AppIcon name="plus" size={14} color={Surface.label} weight="semibold" />
        </Pressable>
      </View>
    </View>
  );
}

function OptionsGroup({
  node,
  selections,
  onChange,
}: {
  node: RequirementWithStatus;
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  const isOptionGroup =
    (node.type === "or_group" || node.type === "options_group") && node.requirementId;
  if (isOptionGroup) {
    const selected = selections.selectedOptionsPerRequirement[node.requirementId!];
    const options = node.options ?? [];
    return (
      <View style={styles.optionGroup}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text size="sm" weight="bold">
              {node.title ?? "Choose an option"}
            </Text>
            <Text size="xs" dimmed>
              Pick the branch you want requirements and generation to follow.
            </Text>
          </View>
          {selected != null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                onChange(clearSelectedOptionForRequirement(selections, node.requirementId!))
              }
              style={styles.clearInline}
            >
              <Text size="xs" color={Surface.accent} weight="bold">
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.optionChoices}>
          {options.map((option, index) => {
            const selectedOption = selected === index;
            const summary = optionSummary(option);
            return (
              <Pressable
                key={`${node.requirementId}-${index}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedOption }}
                onPress={() =>
                  onChange(
                    selectedOption
                      ? clearSelectedOptionForRequirement(selections, node.requirementId!)
                      : setSelectedOptionForRequirement(selections, node.requirementId!, index),
                  )
                }
                style={({ pressed }) => [
                  styles.optionChoice,
                  selectedOption ? styles.optionChoiceSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.optionChoiceCopy}>
                  <Text size="sm" weight={selectedOption ? "bold" : "semibold"}>
                    {optionTitle(option, index)}
                  </Text>
                  {summary ? (
                    <Text size="xs" dimmed>
                      {summary}
                    </Text>
                  ) : null}
                </View>
                <AppIcon
                  name={selectedOption ? "checkmark.circle.fill" : "circle"}
                  size={18}
                  color={selectedOption ? Surface.accent : Surface.dimmed}
                  weight="semibold"
                />
              </Pressable>
            );
          })}
        </View>

        {selected != null && options[selected] ? (
          <NestedOptions nodes={[options[selected]!]} selections={selections} onChange={onChange} />
        ) : null}
      </View>
    );
  }

  return <NestedOptions nodes={node.options ?? []} selections={selections} onChange={onChange} />;
}

function NestedOptions({
  nodes,
  selections,
  onChange,
}: {
  nodes: readonly RequirementWithStatus[];
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  const groups = nodes.filter(nodeHasOptionGroups);
  if (groups.length === 0) return null;
  return (
    <View style={styles.nestedOptions}>
      {groups.map((node, index) => (
        <OptionsGroup
          key={node.requirementId ?? `${node.type}-${index}`}
          node={node}
          selections={selections}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

function RequirementCard({
  requirement,
  selections,
  completedSet,
  titleForCourse,
  onChange,
}: {
  requirement: RemainingRequirement;
  selections: PersonalizeRequirementSelections;
  completedSet: Set<string>;
  titleForCourse: (code: string) => string | undefined;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  const title = requirement.title ?? requirementLabel(requirement.type);
  const subtitle = remainingSubtitle(requirement);
  const assigned = compactCourseSet(selections.selectedPerRequirement, requirement.requirementId);
  const pinned = compactCourseSet(selections.constrainedPerRequirement, requirement.requirementId);
  const candidates = requirement.candidateCourses.slice(0, MAX_CANDIDATES_PER_REQUIREMENT);
  const hiddenCount = Math.max(0, requirement.candidateCourses.length - candidates.length);

  return (
    <View style={styles.requirementCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text size="sm" weight="bold">
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" dimmed>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <PriorityPicker
          requirementIds={[requirement.requirementId]}
          selections={selections}
          onChange={onChange}
        />
      </View>

      {candidates.length > 0 ? (
        <View style={styles.candidates}>
          {candidates.map((code) => {
            const norm = normalizeCourseCode(code);
            const completed = completedSet.has(norm);
            const isAssigned = assigned.has(norm);
            const isPinned = pinned.has(norm);
            return (
              <View key={code} style={styles.candidateRow}>
                <View style={styles.courseCopy}>
                  <Text size="xs" weight="bold" color={Surface.accent}>
                    {code}
                  </Text>
                  <Text size="xs" dimmed numberOfLines={1}>
                    {titleForCourse(code) ?? "Eligible course"}
                  </Text>
                </View>
                <View style={styles.courseActions}>
                  {completed ? (
                    <SelectionChip
                      label={isAssigned ? "Assigned" : "Assign"}
                      icon="checkmark"
                      selected={isAssigned}
                      onPress={() =>
                        onChange(
                          toggleRequirementCourse(
                            selections,
                            requirement.requirementId,
                            code,
                            "assigned",
                          ),
                        )
                      }
                    />
                  ) : (
                    <SelectionChip
                      label={isPinned ? "Pinned" : "Pin"}
                      icon="pin"
                      selected={isPinned}
                      onPress={() =>
                        onChange(
                          toggleRequirementCourse(
                            selections,
                            requirement.requirementId,
                            code,
                            "pinned",
                          ),
                        )
                      }
                    />
                  )}
                </View>
              </View>
            );
          })}
          {hiddenCount > 0 ? (
            <Text size="xs" dimmed>
              {hiddenCount} more eligible course{hiddenCount === 1 ? "" : "s"} hidden.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text size="xs" dimmed>
          No candidate courses are available for this requirement in the loaded catalogue.
        </Text>
      )}
    </View>
  );
}

export function RequirementPlanner({
  readout,
  selections,
  completedCourses,
  titleForCourse,
  onChange,
}: RequirementPlannerProps) {
  const completedSet = useMemo(
    () => new Set(completedCourses.map((code) => normalizeCourseCode(code))),
    [completedCourses],
  );
  const requirementTree = readout.requirementTreeWithStatus ?? [];
  const optionRoots = requirementTree.filter(nodeHasOptionGroups);
  const priorityRootIds = requirementTree.flatMap(requirementIdsForNode);

  return (
    <View style={styles.container}>
      <PersonalizeRequirementsReadoutView readout={readout} />
      <View style={styles.notice}>
        <AppIcon name="sparkles" size={16} color={Surface.accent} weight="semibold" />
        <Text size="xs" dimmed>
          Assigned courses count as already completed. Pinned courses are forced into generated
          schedules.
        </Text>
      </View>

      <CoursesThisSemesterControl selections={selections} onChange={onChange} />

      {optionRoots.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.dimmed}>
            Options
          </Text>
          <NestedOptions nodes={optionRoots} selections={selections} onChange={onChange} />
        </View>
      ) : null}

      {priorityRootIds.length > 1 ? (
        <View style={styles.priorityHelp}>
          <AppIcon name="flag" size={14} color={Surface.dimmed} weight="semibold" />
          <Text size="xs" dimmed>
            Priority 0 schedules together. Higher numbers wait until lower-priority requirements are
            satisfied.
          </Text>
        </View>
      ) : null}

      {readout.remaining.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.dimmed}>
            Assign and pin
          </Text>
          {readout.remaining.map((requirement) => (
            <RequirementCard
              key={requirement.requirementId}
              requirement={requirement}
              selections={selections}
              completedSet={completedSet}
              titleForCourse={titleForCourse}
              onChange={onChange}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.subtle,
    padding: Spacing.three,
  },
  loadControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  loadCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  stepperButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
  },
  section: {
    gap: Spacing.two,
  },
  nestedOptions: {
    gap: Spacing.two,
  },
  optionGroup: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  cardHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  clearInline: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  optionChoices: {
    gap: Spacing.two,
  },
  optionChoice: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.subtle,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionChoiceSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accentSoft,
  },
  optionChoiceCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  priorityHelp: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  priorityRow: {
    alignItems: "flex-end",
    gap: Spacing.one,
  },
  priorityChips: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  priorityChip: {
    minWidth: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
  },
  priorityChipSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accent,
  },
  requirementCard: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  candidates: {
    gap: Spacing.two,
  },
  candidateRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  courseCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  courseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  chip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chipSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accent,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
});
