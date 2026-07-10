import { useMemo } from "react";
import type { DesiredCourseResolution, RemainingRequirement } from "@uoplan/core";
import { buildEffectiveRemainingRequirements, resolveDesiredCourses } from "@uoplan/core";
import { useBasketCourses } from "../../hooks/useBasket";
import { tr } from "../../i18n";
import {
  useCompletedCourses,
  useDataCache,
  useProgramSelection,
  useRequirementState,
} from "@uoplan/store/hooks";
import { useRequirementAssignmentState } from "../../components/requirements/useRequirementAssignmentState";

/** A requirement and the basket courses the resolver assigned to it, with a display title. */
export interface BasketAssignment {
  requirementId: string;
  requirementTitle: string;
  codes: string[];
}

export interface BasketResolution {
  /** Categorized resolution of the basket against the student's remaining requirements. */
  resolution: DesiredCourseResolution;
  /** Per-requirement assignments (assigned basket courses) with display titles. */
  assignments: BasketAssignment[];
  /** The requirement universe the resolution (and the engine) schedules against. */
  effectiveRemainingRequirements: RemainingRequirement[];
  /** Whether a program is set — basket courses fill requirement pools when true, else are forced. */
  hasProgram: boolean;
}

/**
 * Single source of truth for resolving the basket ("courses you want") against the student's
 * remaining requirements. Consumed by the generator sidebar warnings, the floating cart, and the
 * timetable page so they never diverge from one another (or from generation, which calls the same
 * `resolveDesiredCourses` at the worker boundary).
 */
export function useBasketResolution(): BasketResolution {
  const cache = useDataCache();
  const basketCourses = useBasketCourses();
  const { completedCourses } = useCompletedCourses();
  const { prereqEligibleCourses } = useRequirementState();
  const { program, studentPrograms } = useProgramSelection();
  const {
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    constrainedPerRequirement,
    selectedPerRequirement,
  } = useRequirementAssignmentState();

  const hasProgram = program != null || studentPrograms.length > 0;

  return useMemo(() => {
    const effectiveRemainingRequirements = buildEffectiveRemainingRequirements(
      remainingRequirements,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
    );
    const resolution = resolveDesiredCourses(
      effectiveRemainingRequirements,
      basketCourses,
      completedCourses,
      constrainedPerRequirement,
      selectedPerRequirement,
      prereqEligibleCourses,
      cache,
    );
    const titleByReqId = new Map(
      effectiveRemainingRequirements.map((req, index) => [
        req.requirementId,
        req.title ?? tr("generationOptions.warn.assigned.fallbackTitle", { index: index + 1 }),
      ]),
    );
    const assignments: BasketAssignment[] = Object.entries(resolution.assigned).map(
      ([requirementId, codes]) => ({
        requirementId,
        requirementTitle: titleByReqId.get(requirementId) ?? requirementId,
        codes,
      }),
    );
    return { resolution, assignments, effectiveRemainingRequirements, hasProgram };
  }, [
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    basketCourses,
    completedCourses,
    constrainedPerRequirement,
    selectedPerRequirement,
    prereqEligibleCourses,
    cache,
    hasProgram,
  ]);
}
