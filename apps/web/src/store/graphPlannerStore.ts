import type { TranscriptTerm } from "@uoplan/core/transcript";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";
import { DEFAULT_COURSES_THIS_SEMESTER } from "./generationDefaults";

/** localStorage key + schema version for the degree-planner graph (beta). */
const STORAGE_KEY = "uoplan.graphPlanner.v1";
const STORAGE_VERSION = 1;

/** Outcome of generating a single future term. */
export type PlannerTermStatus = "ok" | "partial" | "empty" | "error";

/** A future term the user has "enabled" for planning, plus its generated picks. */
export interface PlannerGeneratedTerm {
  /** PeopleSoft term code (e.g. "2269"). */
  termId: string;
  /** Course codes the generator picked for this term (normalized, in order). */
  courses: string[];
  /** Requested course count at generation time. */
  requestedCount: number;
  /** Generation outcome; `partial` means fewer courses than requested. */
  status: PlannerTermStatus;
  /** Epoch millis of the last generation for this term. */
  generatedAt: number;
}

/**
 * Snapshot of the main store's `coursesThisSemester`, captured when the student
 * opens a future term in the calendar so returning to the planner restores the
 * real (persisted, shareable) count. The real basket is never touched, so only
 * the count needs saving. Kept in memory (navigation is client-side), never
 * persisted.
 */

export interface GraphPlannerState {
  /**
   * Completed courses grouped by the term they were taken in, parsed from the
   * uploaded transcript. Empty when the user hasn't uploaded one (they can
   * still plan future terms from scratch).
   */
  completedCourseTerms: TranscriptTerm[];
  /** True once a transcript has been parsed into {@link completedCourseTerms}. */
  hasTranscript: boolean;
  /** Future term ids the user has enabled, kept sorted chronologically. */
  enabledTermIds: string[];
  /** Per-term requested course count; falls back to {@link defaultCount}. */
  countByTermId: Record<string, number>;
  /** Default course count applied to newly enabled terms. */
  defaultCount: number;
  /** Latest generation result per enabled term. */
  generatedByTermId: Record<string, PlannerGeneratedTerm>;
  /**
   * Full schedule bundle (the exact `GenerateSchedulesResult`) for each enabled
   * term, kept so "open in calendar" can forward the term's precise schedule
   * into the calendar view without re-generating. In-memory only (never
   * persisted): these `GeneratedSchedule` objects are large and are transient
   * refinement state, not something to bloat localStorage or the shareable URL.
   */
  resultByTermId: Record<string, GenerateSchedulesResult>;
  /**
   * Courses the student pinned to a specific future term by editing it in the
   * calendar ("courses you want" for that term). They are forced into that
   * term's generated schedule and survive a full regenerate; the generator
   * fills the remaining slots toward the degree.
   */
  cartByTerm: Record<string, string[]>;
  /**
   * User-adjusted node positions, keyed by React Flow node id. Absolute for
   * top-level nodes (completed courses, future-term containers); relative to the
   * parent container for a future term's child course nodes. Lets a student drag
   * courses anywhere and have it persist across reloads.
   */
  nodePositions: Record<string, { x: number; y: number }>;
  /**
   * When the student opens a future term in the calendar view ("modify this one
   * closely"), we remember which term so the planner can reconcile the calendar's
   * edits back into {@link generatedByTermId} when they return. `null` when no
   * term is being edited in the calendar.
   */
  linkedCalendarTermId: string | null;
  /**
   * The main store's `coursesThisSemester` captured when
   * {@link linkedCalendarTermId} was set, restored on return so opening a term
   * in the calendar is a non-destructive detail view. `null` when no term is
   * linked. In-memory only (see the snapshot docblock above).
   */
  preLinkCoursesThisSemester: number | null;

  /** Replace the completed-term breakdown (called after a transcript upload). */
  setCompletedCourseTerms: (terms: TranscriptTerm[]) => void;
  /** Forget the uploaded transcript's term breakdown. */
  clearTranscript: () => void;
  /** Enable a future term for planning (defaults its count, sorts the list). */
  enableTerm: (termId: string) => void;
  /** Disable a future term and drop its count/result. */
  disableTerm: (termId: string) => void;
  /** Set the requested course count for a specific enabled term. */
  setCountForTerm: (termId: string, count: number) => void;
  /** Set the default count used for newly enabled terms. */
  setDefaultCount: (count: number) => void;
  /** Record a term's generation result. */
  setGeneratedTerm: (result: PlannerGeneratedTerm) => void;
  /** Record a term's full schedule bundle (see {@link resultByTermId}). */
  setTermResult: (termId: string, result: GenerateSchedulesResult) => void;
  /** Replace the pinned "courses you want" for a specific future term. */
  setTermCart: (termId: string, courses: string[]) => void;
  /**
   * Drop cached generation results for `termId` and every later enabled term,
   * so re-running an earlier term invalidates the ones that depended on it.
   */
  clearGeneratedFrom: (termId: string) => void;
  /** Clear every generation result (keeps enabled terms + counts). */
  clearAllGenerated: () => void;
  /** Disable all future terms and drop their counts/results (keeps transcript). */
  clearPlannedTerms: () => void;
  /** Persist a dragged node's position (see {@link nodePositions}). */
  setNodePosition: (id: string, pos: { x: number; y: number }) => void;
  /** Clear all manual node positions, restoring the automatic layout. */
  resetLayout: () => void;
  /**
   * Begin editing a future term in the calendar: remember the term and snapshot
   * the caller's current `coursesThisSemester` so {@link endCalendarLink} can
   * restore it. The real basket is intentionally left untouched.
   */
  beginCalendarLink: (termId: string, priorCoursesThisSemester: number) => void;
  /** Finish calendar editing: clear the linked term and its count snapshot. */
  endCalendarLink: () => void;
  /** Reset the whole planner to its initial empty state. */
  resetPlanner: () => void;
}

/** Clamp a requested course count to a sane, non-zero range. */
const MIN_COUNT = 1;
const MAX_COUNT = 12;
function clampCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_COURSES_THIS_SEMESTER;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count)));
}

/** Sort PeopleSoft term ids chronologically (numeric codes sort in order). */
function sortTermIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

/**
 * In-memory storage used when `localStorage` is unavailable (SSR / prerender /
 * node tests). Keeps the persist middleware quiet instead of logging a failed
 * write on every `set`; persistence simply becomes a no-op off the browser.
 */
function memoryFallbackStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

function plannerStorage(): Storage {
  return typeof localStorage !== "undefined" ? localStorage : memoryFallbackStorage();
}

const initialState = {
  completedCourseTerms: [] as TranscriptTerm[],
  hasTranscript: false,
  enabledTermIds: [] as string[],
  countByTermId: {} as Record<string, number>,
  defaultCount: DEFAULT_COURSES_THIS_SEMESTER,
  generatedByTermId: {} as Record<string, PlannerGeneratedTerm>,
  resultByTermId: {} as Record<string, GenerateSchedulesResult>,
  cartByTerm: {} as Record<string, string[]>,
  nodePositions: {} as Record<string, { x: number; y: number }>,
  linkedCalendarTermId: null as string | null,
  preLinkCoursesThisSemester: null as number | null,
};

export const useGraphPlannerStore = create<GraphPlannerState>()(
  persist(
    (set) => ({
      ...initialState,

      setCompletedCourseTerms: (terms) => set({ completedCourseTerms: terms, hasTranscript: true }),

      clearTranscript: () => set({ completedCourseTerms: [], hasTranscript: false }),

      enableTerm: (termId) =>
        set((s) => {
          if (s.enabledTermIds.includes(termId)) return s;
          return {
            enabledTermIds: sortTermIds([...s.enabledTermIds, termId]),
            countByTermId: { ...s.countByTermId, [termId]: s.defaultCount },
          };
        }),

      disableTerm: (termId) =>
        set((s) => {
          const { [termId]: _removedCount, ...countByTermId } = s.countByTermId;
          const { [termId]: _removedResult, ...generatedByTermId } = s.generatedByTermId;
          const { [termId]: _removedBundle, ...resultByTermId } = s.resultByTermId;
          const { [termId]: _removedCart, ...cartByTerm } = s.cartByTerm;
          return {
            enabledTermIds: s.enabledTermIds.filter((id) => id !== termId),
            countByTermId,
            generatedByTermId,
            resultByTermId,
            cartByTerm,
          };
        }),

      setCountForTerm: (termId, count) =>
        set((s) => ({ countByTermId: { ...s.countByTermId, [termId]: clampCount(count) } })),

      setDefaultCount: (count) => set({ defaultCount: clampCount(count) }),

      setGeneratedTerm: (result) =>
        set((s) => ({ generatedByTermId: { ...s.generatedByTermId, [result.termId]: result } })),

      setTermResult: (termId, result) =>
        set((s) => ({ resultByTermId: { ...s.resultByTermId, [termId]: result } })),

      setTermCart: (termId, courses) =>
        set((s) => ({ cartByTerm: { ...s.cartByTerm, [termId]: courses } })),

      clearGeneratedFrom: (termId) =>
        set((s) => {
          const threshold = Number(termId);
          const generatedByTermId: Record<string, PlannerGeneratedTerm> = {};
          for (const [id, result] of Object.entries(s.generatedByTermId)) {
            if (Number(id) < threshold) generatedByTermId[id] = result;
          }
          const resultByTermId: Record<string, GenerateSchedulesResult> = {};
          for (const [id, bundle] of Object.entries(s.resultByTermId)) {
            if (Number(id) < threshold) resultByTermId[id] = bundle;
          }
          return { generatedByTermId, resultByTermId };
        }),

      clearAllGenerated: () => set({ generatedByTermId: {}, resultByTermId: {} }),

      clearPlannedTerms: () =>
        set({
          enabledTermIds: [],
          countByTermId: {},
          generatedByTermId: {},
          resultByTermId: {},
          cartByTerm: {},
        }),

      setNodePosition: (id, pos) =>
        set((s) => ({ nodePositions: { ...s.nodePositions, [id]: pos } })),

      resetLayout: () => set({ nodePositions: {} }),

      beginCalendarLink: (termId, priorCoursesThisSemester) =>
        set({ linkedCalendarTermId: termId, preLinkCoursesThisSemester: priorCoursesThisSemester }),

      endCalendarLink: () => set({ linkedCalendarTermId: null, preLinkCoursesThisSemester: null }),

      resetPlanner: () => set({ ...initialState }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(plannerStorage),
      // Persist data only — action closures are re-created on rehydrate.
      // `resultByTermId` (large schedule bundles) and `preLinkCoursesThisSemester`
      // (transient calendar-link snapshot) are intentionally in-memory only.
      partialize: (s) => ({
        completedCourseTerms: s.completedCourseTerms,
        hasTranscript: s.hasTranscript,
        enabledTermIds: s.enabledTermIds,
        countByTermId: s.countByTermId,
        defaultCount: s.defaultCount,
        generatedByTermId: s.generatedByTermId,
        cartByTerm: s.cartByTerm,
        nodePositions: s.nodePositions,
        linkedCalendarTermId: s.linkedCalendarTermId,
      }),
    },
  ),
);

/** Requested course count for a term, falling back to the default. */
export function plannerTermCount(state: GraphPlannerState, termId: string): number {
  return state.countByTermId[termId] ?? state.defaultCount;
}
