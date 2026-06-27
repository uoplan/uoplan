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
  setRequirementAssignment,
  setRequirementPriorityForIds,
  type PersonalizeRequirementSelections,
  type PersonalizeRequirementsReadout,
} from "@/lib/personalize-requirements";

const PRIORITIES = [0, 1, 2, 3] as const;

interface RequirementPlannerProps {
  readout: PersonalizeRequirementsReadout;
  selections: PersonalizeRequirementSelections;
  completedCourses: readonly string[];
  titleForCourse: (code: string) => string | undefined;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}

/** A completed course that's an eligible candidate for a remaining requirement. */
interface CompletedCandidate {
  code: string;
  norm: string;
  assigned: boolean;
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

function remainingSubtitle(req: RemainingRequirement, completedCandidateCount: number): string {
  const parts: string[] = [];
  if (req.creditsNeeded != null && req.creditsNeeded > 0) {
    parts.push(`${req.creditsNeeded} credit${req.creditsNeeded === 1 ? "" : "s"} needed`);
  }
  if (completedCandidateCount > 0) {
    parts.push(
      `${completedCandidateCount} completed course${completedCandidateCount === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" · ");
}

/**
 * Completed courses that are eligible candidates for `requirement`, flagged with
 * whether they're already assigned (auto or manually). Only completed courses are
 * selectable — pinning future courses happens through the cart, not here.
 */
function completedCandidatesFor(
  requirement: RemainingRequirement,
  completedSet: Set<string>,
  assignedSet: Set<string>,
): CompletedCandidate[] {
  const out: CompletedCandidate[] = [];
  const seen = new Set<string>();
  for (const code of requirement.candidateCourses) {
    const norm = normalizeCourseCode(code);
    if (!completedSet.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ code, norm, assigned: assignedSet.has(norm) });
  }
  return out;
}

function SelectionChip({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
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
        name="checkmark"
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
  candidates,
  assignedCodes,
  selections,
  titleForCourse,
  onChange,
}: {
  requirement: RemainingRequirement;
  candidates: CompletedCandidate[];
  assignedCodes: string[];
  selections: PersonalizeRequirementSelections;
  titleForCourse: (code: string) => string | undefined;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}) {
  const title = requirement.title ?? requirementLabel(requirement.type);
  const subtitle = remainingSubtitle(requirement, candidates.length);

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

      <View style={styles.candidates}>
        {candidates.map(({ code, norm, assigned }) => (
          <View key={code} style={styles.candidateRow}>
            <View style={styles.courseCopy}>
              <Text size="xs" weight="bold" color={Surface.accent}>
                {code}
              </Text>
              <Text size="xs" dimmed numberOfLines={1}>
                {titleForCourse(code) ?? "Completed course"}
              </Text>
            </View>
            <View style={styles.courseActions}>
              <SelectionChip
                label={assigned ? "Assigned" : "Assign"}
                selected={assigned}
                onPress={() => {
                  const next = assigned
                    ? assignedCodes.filter((entry) => normalizeCourseCode(entry) !== norm)
                    : [...assignedCodes, code];
                  onChange(setRequirementAssignment(selections, requirement.requirementId, next));
                }}
              />
            </View>
          </View>
        ))}
      </View>
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

  // The effective assignment is what's already placed (auto-assignment + any
  // manual edits); the planner only surfaces completed courses to assign.
  const effectiveSelected = readout.selectedPerRequirement ?? selections.selectedPerRequirement;

  // Only requirements that have completed courses to place are actionable here.
  // Everything else (future courses, or already auto-satisfied) needs no input.
  const actionable = useMemo(() => {
    return readout.remaining
      .map((requirement) => {
        const assignedCodes = effectiveSelected[requirement.requirementId] ?? [];
        const assignedSet = new Set(assignedCodes.map((code) => normalizeCourseCode(code)));
        const candidates = completedCandidatesFor(requirement, completedSet, assignedSet);
        return { requirement, candidates, assignedCodes };
      })
      .filter((entry) => entry.candidates.length > 0);
  }, [readout.remaining, effectiveSelected, completedSet]);

  return (
    <View style={styles.container}>
      <CoursesThisSemesterControl selections={selections} onChange={onChange} />

      {actionable.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.accent}>
            Place your completed courses
          </Text>
          <View style={styles.requirementList}>
            {actionable.map(({ requirement, candidates, assignedCodes }) => (
              <RequirementCard
                key={requirement.requirementId}
                requirement={requirement}
                candidates={candidates}
                assignedCodes={assignedCodes}
                selections={selections}
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
            Your completed courses are placed automatically. Adjust the course load above, then
            generate.
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
