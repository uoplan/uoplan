import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataCache, GradeVizData, ProfessorRatingsMap } from "@uoplan/core";
import { buildSwapOptionView } from "@uoplan/core/generation/swapCandidates";

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

  // Refresh the open modal's candidates only when the underlying getter identity
  // actually changes (e.g. the store rebinds it). The initial open is already
  // computed synchronously in `openModal`, so we must NOT recompute here just
  // because `swapModal` was set — that doubled the (potentially expensive)
  // candidate computation on every open.
  const swapModalRef = useRef(swapModal);
  swapModalRef.current = swapModal;
  const lastGetterRef = useRef(getSwapCandidates);
  useEffect(() => {
    if (lastGetterRef.current === getSwapCandidates) return;
    lastGetterRef.current = getSwapCandidates;
    const current = swapModalRef.current;
    if (!current) return;
    setSwapResult(getSwapCandidates(current.enrollmentIndex));
    setLoading(false);
  }, [getSwapCandidates]);

  // Build dropdown options from candidates
  const candidateOptions = useMemo<SwapCandidateOption[]>(() => {
    function buildOption(
      code: string,
    ): Omit<SwapCandidateOption, "value" | "disabled" | "conflictsWith"> {
      const { label, title, aPlusPercent, avgRating, gpa, gradeViz } = buildSwapOptionView(
        code,
        cache,
        professorRatings,
      );
      return { label, title, aPlusPercent, avgRating, gpa, gradeViz };
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
    // Only clear the open/active state. Keep the last `swapResult`/`query` so the
    // popover's content stays stable through its close transition instead of
    // collapsing (candidate list + requirement title vanishing) and visibly
    // shifting up. `openModal` always sets fresh data, so stale values held while
    // closed are never shown again.
    setSwapModal(null);
    setLoading(false);
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
