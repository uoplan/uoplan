import { useMemo } from "react";

import type { SchedulesData } from "@uoplan/core/dataTypes";
import type { DataCache } from "@uoplan/core/dataCache";
import { buildPrereqContext, getDisciplineCodesForProgram, type PrereqContext } from "@uoplan/core";

import { useBasket } from "@/data/basket-provider";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useAppData } from "@/data/data-provider";
import type { ExploreCourseEntry } from "@/data/explore-index";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import {
  buildBasketStatusCache,
  getBasketCourseStatus,
  type BasketCourseStatus,
} from "@/lib/basket-status";

/** A basket course paired with its resolved readiness status. */
export interface BasketStatusItem {
  code: string;
  course: ExploreCourseEntry | null;
  status: BasketCourseStatus;
}

function fallbackSchedules(termId: string | null | undefined): SchedulesData {
  return { termId: termId ?? "0", schedules: [] };
}

/**
 * Resolve every basket course's readiness status (prerequisites met + offered in
 * the selected term) against the loaded catalogue. Shared by the basket drawer
 * (which groups by status) and the global cart FAB (which flips its badge to a
 * "!" when {@link hasIssue}), so both read the SAME status from one place.
 */
export function useBasketStatus(): { items: BasketStatusItem[]; hasIssue: boolean } {
  const { codes } = useBasket();
  const { index } = useAppData();
  const { statusCache, selectedTermId, termNameById, hasProfileContext, completedCodes } =
    useBasketStatusContext();

  const items = useMemo<BasketStatusItem[]>(() => {
    const byCode = new Map(index.courses.map((c) => [c.code, c] as const));
    return codes.map((code) => {
      const course = byCode.get(code) ?? null;
      const status = getBasketCourseStatus({
        course: { code, termIds: course?.termIds ?? [] },
        completedCodes,
        cache: statusCache,
        selectedTermId,
        termNameById,
        hasProfileContext,
      });
      return { code, course, status };
    });
  }, [
    codes,
    completedCodes,
    index.courses,
    selectedTermId,
    statusCache,
    termNameById,
    hasProfileContext,
  ]);

  const hasIssue = useMemo(
    () =>
      items.some(
        (item) => item.status.offering === "not_offered" || item.status.prerequisite === "not_met",
      ),
    [items],
  );

  return { items, hasIssue };
}

/**
 * Resolve a single (arbitrary) course's readiness status — used by the
 * course-detail screen to decide whether the viewed course can be added to the
 * cart. Prerequisites are evaluated against the user's COMPLETED courses
 * (transcript + personalize), never the rest of the generation cart.
 */
export function useCourseStatus(course: {
  code: string;
  termIds?: readonly string[] | null;
}): BasketCourseStatus {
  const { statusCache, selectedTermId, termNameById, hasProfileContext, completedCodes } =
    useBasketStatusContext();
  return useMemo(
    () =>
      getBasketCourseStatus({
        course: { code: course.code, termIds: course.termIds ?? [] },
        completedCodes,
        cache: statusCache,
        selectedTermId,
        termNameById,
        hasProfileContext,
      }),
    [
      course.code,
      course.termIds,
      completedCodes,
      selectedTermId,
      statusCache,
      termNameById,
      hasProfileContext,
    ],
  );
}

/**
 * Build the shared {@link DataCache} + term lookups that back the basket status
 * helpers. Memoised on the catalogue + selected term so the (expensive) cache is
 * built once per term, then reused by both {@link useBasketStatus} and
 * {@link useCourseStatus}.
 */
function useBasketStatusContext() {
  const { bundle, schedulesByTerm } = useAppData();
  const { personalization } = useScheduleOptions();
  const { codes: completedCodes } = useCompletedCourses();
  const selectedTermId = personalization.termId;

  // The planner has academic grounding once the user uploads/selects a program
  // or picks a start year. Without either (and with no completed courses),
  // prerequisite checks are suppressed — see {@link getBasketCourseStatus}.
  const hasProfileContext =
    Boolean(personalization.programUrl) || Boolean(personalization.startYear);

  const termNameById = useMemo(
    () => new Map(bundle.terms.map((term) => [String(term.termId), term.name] as const)),
    [bundle.terms],
  );

  const statusCache = useMemo(() => {
    const selectedSchedules = selectedTermId ? schedulesByTerm.get(selectedTermId) : undefined;
    const schedules =
      selectedSchedules ??
      schedulesByTerm.values().next().value ??
      fallbackSchedules(selectedTermId);
    return buildBasketStatusCache(bundle.catalogue, schedules, {
      disciplines: bundle.disciplines,
      faculties: bundle.faculties,
    });
  }, [bundle.catalogue, bundle.disciplines, bundle.faculties, schedulesByTerm, selectedTermId]);

  const studentPrograms = useMemo(
    () =>
      getDisciplineCodesForProgram(
        bundle.catalogue.programs.find((p) => p.url === personalization.programUrl) ?? null,
      ),
    [bundle.catalogue.programs, personalization.programUrl],
  );

  return {
    statusCache,
    selectedTermId,
    termNameById,
    hasProfileContext,
    completedCodes,
    studentPrograms,
  };
}

/**
 * Expose the prerequisite graph context (DataCache + PrereqContext) for use by
 * the native prerequisite graph renderer. Reuses the same memoized statusCache
 * built by {@link useBasketStatusContext} — no duplicate expensive cache builds.
 *
 * Returns `null` for `plannerContext` when the user has no academic grounding
 * (no profile context and no completed courses), because prerequisite status
 * can't be evaluated without either. Otherwise builds a {@link PrereqContext}
 * from the user's completed courses against the status cache.
 */
export function useNativePrereqGraphContext(): {
  cache: DataCache;
  plannerContext: PrereqContext | null;
} {
  const { statusCache, hasProfileContext, completedCodes, studentPrograms } =
    useBasketStatusContext();

  const plannerContext = useMemo<PrereqContext | null>(() => {
    if (!hasProfileContext && completedCodes.length === 0) return null;
    return buildPrereqContext([...completedCodes], statusCache, studentPrograms);
  }, [hasProfileContext, completedCodes, statusCache, studentPrograms]);

  return { cache: statusCache, plannerContext };
}
