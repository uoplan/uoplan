import type { TranscriptTerm } from "@uoplan/core/transcript";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";
import type { AppState } from "@uoplan/store/types";
import { DEFAULT_COURSES_THIS_SEMESTER } from "@uoplan/store/generationDefaults";

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
 * Snapshot of the main store's *real* generation context, captured when the
 * student opens a future term in the calendar. While a term is linked the main
 * store temporarily holds that term's hypothetical completed-course context (the
 * real transcript plus every earlier planned term's picks) so the calendar
 * generates exactly like the normal flow with those prior terms already
 * completed. This snapshot restores the student's real, persisted state on
 * return. The real basket is never touched, so it isn't part of the snapshot.
 * Kept in memory only (navigation is client-side), never persisted.
 */
export type PlannerCalendarSnapshot = Pick<
  AppState,
  | "completedCourses"
  | "selectedTermId"
  | "schedulesData"
  | "cache"
  | "coursesThisSemester"
  | "remainingRequirements"
  | "requirementTreeWithStatus"
  | "completedRequirementsList"
  | "selectedPerRequirement"
  | "selectedOptionsPerRequirement"
  | "prereqEligibleCourses"
  | "filteredPrereqEligibleCourses"
  | "unassignedCompletedCourses"
>;

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
   * term, kept so the graph can render each term's precise timetable in a
   * calendar and "open in calendar" can forward it without re-generating.
   * Persisted so the term calendars survive a reload; it only ever lands in
   * localStorage (never the shareable URL, which is encoded by the main store).
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
   * Per-term generation seed (the engine's `currentSeed`). Advanced by one step
   * each time a term is regenerated so successive "Regenerate" clicks yield
   * different schedule variants instead of the same deterministic result.
   * Absent / `0` means "not yet generated" — the first run anchors on the main
   * store's `firstSeed`.
   */
  seedByTermId: Record<string, number>;
  /**
   * User-adjusted node positions, keyed by React Flow node id. Absolute for
   * top-level nodes (completed courses, future-term containers); relative to the
   * parent container for a future term's child course nodes. Lets a student drag
   * courses anywhere and have it persist across reloads.
   */
  nodePositions: Record<string, { x: number; y: number }>;
  /**
   * User-adjusted node sizes, keyed by React Flow node id. Currently only
   * future-term calendar containers are resizable; the stored size overrides the
   * automatic layout so a student can grow a term's calendar and have it persist.
   */
  nodeSizes: Record<string, { width: number; height: number }>;
  /**
   * Position of the floating planner panel on the graph canvas, as a top-left
   * offset (px) from the canvas's top-left corner. `null` uses the default
   * detached anchor (top-left with a gap). Persisted so the panel stays where
   * the student dragged it.
   */
  panelPosition: { x: number; y: number } | null;
  /**
   * Explicit size (px) of the floating planner panel when the student has resized
   * it via the corner handle. `null` uses the default responsive size. Persisted.
   */
  panelSize: { width: number; height: number } | null;
  /**
   * Whether the floating planner panel is collapsed to just its header. Lets the
   * student tuck the controls away to see the full graph. Persisted.
   */
  panelCollapsed: boolean;
  /**
   * When the student opens a future term in the calendar view ("modify this one
   * closely"), we remember which term so the planner can reconcile the calendar's
   * edits back into {@link generatedByTermId} when they return. `null` when no
   * term is being edited in the calendar.
   */
  linkedCalendarTermId: string | null;
  /**
   * The main store's real generation context captured when
   * {@link linkedCalendarTermId} was set, restored on return so opening a term
   * in the calendar is a non-destructive detail view over a hypothetical "prior
   * terms completed" context. `null` when no term is linked. In-memory only (see
   * the snapshot docblock above).
   */
  preLinkCompletedContext: PlannerCalendarSnapshot | null;
  /**
   * The future term currently focused in the tabbed planner panel (its calendar
   * node is highlighted). `null` shows the panel's "Overview" (global controls)
   * tab and highlights no node. Selecting a term tab or clicking its node sets
   * this; enabling a term focuses it; disabling/clearing the focused term resets
   * it. Persisted so focus survives a reload (clamped to a still-planned term).
   */
  selectedTermId: string | null;

  /** Replace the completed-term breakdown (called after a transcript upload). */
  setCompletedCourseTerms: (terms: TranscriptTerm[]) => void;
  /** Forget the uploaded transcript's term breakdown. */
  clearTranscript: () => void;
  /** Enable a future term for planning (defaults its count, sorts the list). */
  enableTerm: (termId: string) => void;
  /** Disable a future term and drop its count/result. */
  disableTerm: (termId: string) => void;
  /** Focus a future term in the panel (or `null` for the Overview tab). */
  setSelectedTermId: (termId: string | null) => void;
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
  /** Persist the seed used to generate a term (see {@link seedByTermId}). */
  setTermSeed: (termId: string, seed: number) => void;
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
  /** Persist a resized node's size (see {@link nodeSizes}). */
  setNodeSize: (id: string, size: { width: number; height: number }) => void;
  /** Clear all manual node positions, restoring the automatic layout. */
  resetLayout: () => void;
  /** Persist the floating panel's dragged position (see {@link panelPosition}). */
  setPanelPosition: (pos: { x: number; y: number } | null) => void;
  /** Persist the floating panel's resized dimensions (see {@link panelSize}). */
  setPanelSize: (size: { width: number; height: number } | null) => void;
  /** Collapse or expand the floating planner panel (see {@link panelCollapsed}). */
  setPanelCollapsed: (collapsed: boolean) => void;
  /**
   * Begin editing a future term in the calendar: remember the term and snapshot
   * the caller's real generation context so {@link endCalendarLink} can restore
   * it. While linked, the main store holds the term's hypothetical completed set
   * (real transcript + earlier planned terms). The real basket is intentionally
   * left untouched.
   */
  beginCalendarLink: (termId: string, snapshot: PlannerCalendarSnapshot) => void;
  /** Finish calendar editing: clear the linked term and its context snapshot. */
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
  seedByTermId: {} as Record<string, number>,
  nodePositions: {} as Record<string, { x: number; y: number }>,
  nodeSizes: {} as Record<string, { width: number; height: number }>,
  panelPosition: null as { x: number; y: number } | null,
  panelSize: null as { width: number; height: number } | null,
  panelCollapsed: false,
  linkedCalendarTermId: null as string | null,
  preLinkCompletedContext: null as PlannerCalendarSnapshot | null,
  selectedTermId: null as string | null,
};

export const useGraphPlannerStore = create<GraphPlannerState>()(
  persist(
    (set) => ({
      ...initialState,

      setCompletedCourseTerms: (terms) => set({ completedCourseTerms: terms, hasTranscript: true }),

      clearTranscript: () => set({ completedCourseTerms: [], hasTranscript: false }),

      enableTerm: (termId) =>
        set((s) => {
          if (s.enabledTermIds.includes(termId)) return { selectedTermId: termId };
          return {
            enabledTermIds: sortTermIds([...s.enabledTermIds, termId]),
            countByTermId: { ...s.countByTermId, [termId]: s.defaultCount },
            selectedTermId: termId,
          };
        }),

      setSelectedTermId: (termId) => set({ selectedTermId: termId }),

      disableTerm: (termId) =>
        set((s) => {
          const { [termId]: _removedCount, ...countByTermId } = s.countByTermId;
          const { [termId]: _removedResult, ...generatedByTermId } = s.generatedByTermId;
          const { [termId]: _removedBundle, ...resultByTermId } = s.resultByTermId;
          const { [termId]: _removedCart, ...cartByTerm } = s.cartByTerm;
          const { [termId]: _removedSeed, ...seedByTermId } = s.seedByTermId;
          return {
            enabledTermIds: s.enabledTermIds.filter((id) => id !== termId),
            countByTermId,
            generatedByTermId,
            resultByTermId,
            cartByTerm,
            seedByTermId,
            selectedTermId: s.selectedTermId === termId ? null : s.selectedTermId,
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

      setTermSeed: (termId, seed) =>
        set((s) => ({ seedByTermId: { ...s.seedByTermId, [termId]: seed } })),

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

      clearAllGenerated: () => set({ generatedByTermId: {}, resultByTermId: {}, seedByTermId: {} }),

      clearPlannedTerms: () =>
        set({
          enabledTermIds: [],
          countByTermId: {},
          generatedByTermId: {},
          resultByTermId: {},
          cartByTerm: {},
          seedByTermId: {},
          selectedTermId: null,
        }),

      setNodePosition: (id, pos) =>
        set((s) => ({ nodePositions: { ...s.nodePositions, [id]: pos } })),

      setNodeSize: (id, size) => set((s) => ({ nodeSizes: { ...s.nodeSizes, [id]: size } })),

      resetLayout: () =>
        set({ nodePositions: {}, nodeSizes: {}, panelPosition: null, panelSize: null }),

      setPanelPosition: (pos) => set({ panelPosition: pos }),

      setPanelSize: (size) => set({ panelSize: size }),

      setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),

      beginCalendarLink: (termId, snapshot) =>
        set({ linkedCalendarTermId: termId, preLinkCompletedContext: snapshot }),

      endCalendarLink: () => set({ linkedCalendarTermId: null, preLinkCompletedContext: null }),

      resetPlanner: () => set({ ...initialState }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(plannerStorage),
      // Persist data only — action closures are re-created on rehydrate.
      // `preLinkCompletedContext` (transient calendar-link context snapshot) is
      // intentionally in-memory only. `resultByTermId` IS persisted so the graph
      // can redraw each term's calendar after a reload.
      partialize: (s) => ({
        completedCourseTerms: s.completedCourseTerms,
        hasTranscript: s.hasTranscript,
        enabledTermIds: s.enabledTermIds,
        countByTermId: s.countByTermId,
        defaultCount: s.defaultCount,
        generatedByTermId: s.generatedByTermId,
        resultByTermId: s.resultByTermId,
        cartByTerm: s.cartByTerm,
        seedByTermId: s.seedByTermId,
        nodePositions: s.nodePositions,
        nodeSizes: s.nodeSizes,
        panelPosition: s.panelPosition,
        panelSize: s.panelSize,
        panelCollapsed: s.panelCollapsed,
        linkedCalendarTermId: s.linkedCalendarTermId,
        selectedTermId: s.selectedTermId,
      }),
      // On reload, drop a persisted focus that no longer maps to an enabled term
      // (e.g. the plan was cleared in another tab) so the panel opens on Overview.
      onRehydrateStorage: () => (state) => {
        if (state && state.selectedTermId && !state.enabledTermIds.includes(state.selectedTermId)) {
          state.selectedTermId = null;
        }
      },
    },
  ),
);

/** Requested course count for a term, falling back to the default. */
export function plannerTermCount(state: GraphPlannerState, termId: string): number {
  return state.countByTermId[termId] ?? state.defaultCount;
}
