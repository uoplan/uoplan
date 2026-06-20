import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";
import type { RemainingRequirement } from "@uoplan/core/requirements";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { AppIcon } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";
import {
  getRequirementPriorityForIds,
  setCoursesThisSemester,
  setRequirementPriorityForIds,
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
          Set the course load for the schedule generator.
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schedule fewer courses"
          onPress={() => onChange(setCoursesThisSemester(selections, count - 1))}
          hitSlop={5}
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
          hitSlop={5}
          style={styles.stepperButton}
        >
          <AppIcon name="plus" size={14} color={Surface.label} weight="semibold" />
        </Pressable>
      </View>
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

  return (
    <View style={styles.container}>
      <CoursesThisSemesterControl selections={selections} onChange={onChange} />

      {readout.remaining.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.accent}>
            Needs a choice
          </Text>
          <View style={styles.requirementList}>
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
        </View>
      ) : (
        <View style={styles.allSet}>
          <Text size="sm" weight="bold">
            All set
          </Text>
          <Text size="xs" dimmed>
            There are no missing requirements left to choose.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  loadControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 20,
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
    width: 38,
    height: 38,
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
  requirementList: {
    gap: Spacing.three,
  },
  allSet: {
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 20,
    backgroundColor: Surface.subtle,
    padding: Spacing.four,
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
  priorityRow: {
    alignItems: "flex-start",
    gap: Spacing.one,
  },
  priorityChips: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  priorityChip: {
    minWidth: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 12,
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
    borderRadius: 22,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  candidates: {
    gap: Spacing.two,
  },
  candidateRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.subtle,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
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
