import { useState, useEffect, useMemo, useCallback } from "react";
import type { DataCache, ProfessorRatingsMap, GradeVizData } from "@uoplan/core";
import {
  courseAPlusPercent,
  distributionGpa,
  getRatingsForInstructors,
  normalizeCourseCode,
  aggregateCourseDistribution,
  normalizeGradeVizDistribution,
} from "@uoplan/core";

/**
 * Type for the swap candidates getter function.
 */
type SwapCandidatesGetter = (enrollmentIndex: number) => {
  candidates: string[];
  poolCourses: string[];
  requirementTitle?: string;
  rejectedWithConflict: Array<{ code: string; conflictsWith: string }>;
};

/**
 * State for the swap modal.
 */
export interface SwapModalState {
  enrollmentIndex: number;
  courseCode: string;
  /** Unique id of the clicked calendar block (anchors the desktop popover). */
  eventId?: string;
  /** Set from the clicked calendar block when opening the swap modal. */
  virtual?: boolean;
  /** Component/section line for the clicked block (e.g. "LEC - A01"). */
  componentSection?: string;
  gradeViz?: GradeVizData | null;
}

/**
 * Result from the swap candidates getter.
 */
export interface SwapResult {
  candidates: string[];
  poolCourses: string[];
  requirementTitle?: string;
  rejectedWithConflict: Array<{ code: string; conflictsWith: string }>;
}

/**
 * Option for the swap dropdown.
 */
export interface SwapCandidateOption {
  value: string;
  label: string;
  disabled: boolean;
  conflictsWith?: string;
  title: string | null;
  aPlusPercent: number | null;
  avgRating: number | null;
  /** Mean course GPA (0–10) from aggregated grade distribution, for difficulty filtering. */
  gpa: number | null;
  gradeViz: GradeVizData | null;
}

const EMPTY_SWAP_RESULT: SwapResult = {
  candidates: [],
  poolCourses: [],
  rejectedWithConflict: [],
};

/**
 * Hook for managing swap modal state and loading candidates.
 *
 * @param getSwapCandidates - Function to fetch swap candidates
 * @param cache - Data cache for looking up course info
 */
export function useSwapModal(
  getSwapCandidates: SwapCandidatesGetter,
  cache: DataCache | null,
  professorRatings: ProfessorRatingsMap | null,
) {
  const [swapModal, setSwapModal] = useState<SwapModalState | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult>(EMPTY_SWAP_RESULT);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Keep candidates in sync if the underlying getter changes while the modal is
  // open. The initial result is computed synchronously in `openModal` so the
  // popover's first paint already shows the correct list (no open-then-flash).
  // This effect only refreshes that result without flipping `loading` back on or
  // clearing the list, so it can't reintroduce a flash/reflow.
  useEffect(() => {
    if (!swapModal) return;
    setSwapResult(getSwapCandidates(swapModal.enrollmentIndex));
    setLoading(false);
  }, [getSwapCandidates, swapModal]);

  // Build dropdown options from candidates
  const candidateOptions = useMemo<SwapCandidateOption[]>(() => {
    function buildOption(
      code: string,
    ): Omit<SwapCandidateOption, "value" | "disabled" | "conflictsWith"> {
      const norm = normalizeCourseCode(code);
      const course = cache?.getCourse(norm);
      const title = (course?.title ?? "").trim() || null;
      const sched = cache?.getSchedule(norm);
      const aPlus = sched ? courseAPlusPercent(sched) : null;
      const dist = sched ? aggregateCourseDistribution(sched) : null;
      const gpa = dist ? distributionGpa(dist) : null;
      const gradeViz = dist ? normalizeGradeVizDistribution(dist) : null;
      const instructors = sched
        ? [
            ...new Set(
              Object.values(sched.components ?? {})
                .flat()
                .flatMap((sec) => sec.times.map((t) => t.instructor))
                .filter((i): i is string => typeof i === "string"),
            ),
          ]
        : [];
      const ratings = getRatingsForInstructors(instructors, professorRatings);
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;
      const label = title ? `${code} — ${title}` : code;
      return { label, title, aPlusPercent: aPlus, avgRating, gpa, gradeViz };
    }

    const valid = swapResult.candidates.map((code) => ({
      value: code,
      disabled: false as const,
      ...buildOption(code),
    }));

    const rejected = (swapResult.rejectedWithConflict ?? []).map(({ code, conflictsWith }) => ({
      value: `__rejected:${code}`,
      disabled: true as const,
      conflictsWith,
      ...buildOption(code),
    }));

    return [...valid, ...rejected];
  }, [cache, professorRatings, swapResult.candidates, swapResult.rejectedWithConflict]);

  const openModal = useCallback(
    (
      enrollmentIndex: number,
      courseCode: string,
      ctx?: {
        eventId?: string;
        virtual?: boolean;
        componentSection?: string;
        gradeViz?: GradeVizData | null;
      },
    ) => {
      setSwapModal({
        enrollmentIndex,
        courseCode,
        eventId: ctx?.eventId,
        virtual: ctx?.virtual,
        componentSection: ctx?.componentSection,
        gradeViz: ctx?.gradeViz,
      });
      // Compute candidates synchronously so the list is already correct on the
      // popover's first paint instead of flashing in a tick later.
      setSwapResult(getSwapCandidates(enrollmentIndex));
      setLoading(false);
      setQuery("");
    },
    [getSwapCandidates],
  );

  const closeModal = useCallback(() => {
    setSwapModal(null);
    setSwapResult(EMPTY_SWAP_RESULT);
    setLoading(false);
    setQuery("");
  }, []);

  return {
    // Modal state
    isOpen: swapModal !== null,
    modalState: swapModal,
    openModal,
    closeModal,

    // Loading state
    loading,

    // Results
    result: swapResult,
    candidateOptions,

    // Search
    query,
    setQuery,
  };
}
