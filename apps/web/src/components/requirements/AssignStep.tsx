import { useMemo } from "react";
import { Alert, Stack, Text } from "@mantine/core";
import type {
  CompletedRequirementItem,
  DataCache,
  RemainingRequirement,
  RequirementWithStatus,
} from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { useAppStore } from "../../store/appStore";
import { RequirementNode } from "./RequirementNode";
import { getStableNodeKey } from "../../lib/requirements/requirementNodeUtils";
import {
  applyOptionSelections,
  nodeHasOptionGroups,
  pruneUnresolvedOptionGroups,
} from "../../lib/requirements/requirementUtils";
import { tr } from "../../i18n";
import { CompletedRequirementsAccordion } from "./CompletedRequirementsAccordion";
import { FrenchImmersionRequirementsReadout } from "./FrenchImmersionRequirementsReadout";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssignStepProps {
  cache: DataCache | null;
  remainingRequirements: RemainingRequirement[];
  requirementTreeWithStatus: RequirementWithStatus[];
  completedRequirementsList: CompletedRequirementItem[];
  completedCourses: string[];
  unassignedCompletedCourses: string[];
  constrainedPerRequirement: Record<string, string[]>;
  selectedPerRequirement: Record<string, string[]>;
  onSelect: (requirementId: string, courses: string[]) => void;
  selectedOptionsPerRequirement: Record<string, number>;
  prereqEligibleCourses: string[];
  includeClosedComponents?: boolean;
  virtualSectionsOnly?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssignStep({
  cache,
  remainingRequirements: _remainingRequirements,
  requirementTreeWithStatus,
  completedRequirementsList,
  completedCourses,
  unassignedCompletedCourses,
  constrainedPerRequirement,
  selectedPerRequirement,
  onSelect,
  selectedOptionsPerRequirement,
  prereqEligibleCourses,
  includeClosedComponents = true,
  virtualSectionsOnly = false,
}: AssignStepProps) {
  const frenchImmersionStream = useAppStore((s) => s.frenchImmersionStream);
  const completedSet = new Set(completedCourses);
  const prereqEligible = new Set(prereqEligibleCourses);
  const unassignedCompletedSet = new Set(unassignedCompletedCourses);
  const unassignedCompletedSetNormalized = new Set(
    unassignedCompletedCourses.map((c) => normalizeCourseCode(c)),
  );

  const flattenedTree = useMemo(
    () => applyOptionSelections(requirementTreeWithStatus, selectedOptionsPerRequirement),
    [requirementTreeWithStatus, selectedOptionsPerRequirement],
  );

  // Display-only: hide option groups the user has not resolved in the Program
  // options step (they would otherwise render as bloated "one of the following"
  // drilldowns). Keep `flattenedTree` for the assignment calculations below.
  const displayTree = useMemo(() => pruneUnresolvedOptionGroups(flattenedTree), [flattenedTree]);
  const hasPendingOptions = useMemo(() => flattenedTree.some(nodeHasOptionGroups), [flattenedTree]);

  const allAssignedCoursesNormalized = useMemo(() => {
    const set = new Set<string>();
    const walk = (nodes: RequirementWithStatus[]) => {
      for (const node of nodes) {
        if ((node.type === "course" || node.type === "or_course") && node.satisfiedBy?.length) {
          for (const code of node.satisfiedBy) set.add(normalizeCourseCode(code));
        }
        if (node.options?.length) walk(node.options);
      }
    };
    walk(flattenedTree);
    for (const codes of Object.values(selectedPerRequirement)) {
      for (const code of codes) set.add(normalizeCourseCode(code));
    }
    return set;
  }, [flattenedTree, selectedPerRequirement]);

  const hasTree = flattenedTree.length > 0;
  const incompleteNodes = displayTree.filter((node) => !node.complete);
  const hasRemaining = incompleteNodes.length > 0;
  const hasCompleted = completedRequirementsList.length > 0;

  if (!hasTree) {
    return (
      <Alert color="blue" variant="light" radius="var(--app-radius)">
        <Text size="sm">Select a program and complete the previous steps to see requirements.</Text>
      </Alert>
    );
  }

  const unassignedDisplay = [...new Set(unassignedCompletedCourses)]
    .map((c) => cache?.getCourse(normalizeCourseCode(c))?.code ?? c)
    .sort();

  return (
    <Stack gap="lg" data-tour="assign-requirements">
      {frenchImmersionStream ? <FrenchImmersionRequirementsReadout /> : null}
      {unassignedDisplay.length > 0 ? (
        <Alert
          color="yellow"
          variant="light"
          radius="var(--app-radius)"
          title="Assign all completed courses before continuing"
          aria-live="polite"
        >
          <Text size="sm">
            You have {unassignedDisplay.length} completed course
            {unassignedDisplay.length === 1 ? "" : "s"} not assigned to any requirement:{" "}
            {unassignedDisplay.join(", ")}.
          </Text>
          <Text size="sm" mt={6}>
            Assign each completed course to the requirement it satisfies.
          </Text>
        </Alert>
      ) : (
        <Alert
          color="green"
          variant="light"
          radius="var(--app-radius)"
          title="All courses assigned"
          aria-live="polite"
        >
          <Text size="sm">All completed courses are assigned to requirements.</Text>
        </Alert>
      )}

      <Alert color="blue" variant="light" radius="var(--app-radius)">
        <Text size="sm">
          For each requirement below, assign the completed courses that satisfy it. Only your
          completed courses are shown in the dropdowns.
        </Text>
      </Alert>

      <Stack gap="md">
        {hasRemaining ? (
          incompleteNodes.map((node, idx) => {
            const nodeKey = getStableNodeKey(node, `root:${idx}`);
            return (
              <RequirementNode
                key={nodeKey}
                node={node}
                cache={cache}
                completedCourses={completedSet}
                selectedPerRequirement={selectedPerRequirement}
                constrainedPerRequirement={constrainedPerRequirement}
                onSelect={onSelect}
                activeBranch
                prereqEligible={prereqEligible}
                levelBuckets={["undergrad", "grad"]}
                languageBuckets={["en", "fr", "other"]}
                electiveLevelBuckets={[]}
                unassignedCompletedSet={unassignedCompletedSet}
                unassignedCompletedSetNormalized={unassignedCompletedSetNormalized}
                allAssignedCoursesNormalized={allAssignedCoursesNormalized}
                includeClosedComponents={includeClosedComponents}
                virtualSectionsOnly={virtualSectionsOnly}
                completedOnly
              />
            );
          })
        ) : (
          <Alert color="blue" variant="light" radius="var(--app-radius)">
            <Text size="sm">
              {hasPendingOptions
                ? tr("requirements.optionsPending")
                : "All requirements are currently satisfied by your completed courses."}
            </Text>
          </Alert>
        )}
      </Stack>

      {hasCompleted && (
        <CompletedRequirementsAccordion completedItems={completedRequirementsList} />
      )}
    </Stack>
  );
}
