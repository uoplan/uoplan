import type { CoursePrereqNode, DataCache } from "@uoplan/core";
import type { TranscriptTerm } from "@uoplan/core/transcript";
import type { PlannerTermStatus } from "../../store/graphPlannerStore";

/** A future term the user can plan into, pre-formatted by the caller. */
export interface PlannerFutureTerm {
  termId: string;
  /** Localized display label (caller formats via `formatTermLabel`). */
  label: string;
  enabled: boolean;
  /** Generated course codes (empty until generated). */
  courses: string[];
  status?: PlannerTermStatus;
}

export interface BuildPlannerGraphInput {
  completedTerms: TranscriptTerm[];
  futureTerms: PlannerFutureTerm[];
  cache: DataCache | null;
  /**
   * User-adjusted node positions keyed by node id, overriding the automatic
   * layout. Absolute for top-level nodes (completed course chips and future
   * term calendars).
   */
  positions?: Record<string, { x: number; y: number }>;
  /**
   * User-adjusted node sizes keyed by node id, overriding the automatic layout.
   * Only future-term calendar containers are resizable.
   */
  sizes?: Record<string, { width: number; height: number }>;
}

/** Per-node health used for coloring. */
export type PlannerNodeStatus = "completed" | "planned" | "missingPrereq";

export interface PlannerNodeData {
  code: string;
  title: string;
  status: PlannerNodeStatus;
  /** The term this course was completed in (completed nodes only). */
  term?: string;
  [key: string]: unknown;
}

export interface PlannerBandData {
  label: string;
  kind: "completed" | "future";
  termId?: string;
  enabled: boolean;
  courseCount: number;
  status?: PlannerTermStatus;
  [key: string]: unknown;
}

/** Minimal React-Flow-compatible node/edge shapes (kept dependency-free here). */
export interface PlannerFlowNode<T> {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: T;
  draggable: boolean;
  selectable: boolean;
  zIndex: number;
  width?: number;
  height?: number;
  /** Parent container id (reserved for child nodes; unused by current layout). */
  parentId?: string;
  /** Constrain dragging to the parent container ("parent"). */
  extent?: "parent";
  style?: Record<string, string | number>;
}

export interface PlannerFlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface PlannerGraph {
  /** Completed term blocks + future-term calendar containers. */
  bandNodes: PlannerFlowNode<PlannerBandData>[];
  /** Completed course chips (future terms render their courses inside the calendar). */
  courseNodes: PlannerFlowNode<PlannerNodeData>[];
  edges: PlannerFlowEdge[];
  width: number;
  height: number;
}

/** Layout constants (px) for the planner canvas. */
const PLANNER_LAYOUT = {
  nodeWidth: 184,
  nodeHeight: 62,
  rowGap: 30,
  /** Horizontal gap between stacked sub-columns inside one completed term block. */
  innerGapX: 40,
  /** Inner horizontal padding of a completed term block. */
  bandPadX: 16,
  /** Inner bottom padding of a completed term block. */
  bandPadBottom: 18,
  /** Header strip at the top of a completed term block reserved for its label. */
  bandHeaderHeight: 44,
  /** Horizontal gap between adjacent completed term blocks. */
  bandGap: 40,
  /** Max courses stacked in a term block's sub-column before it wraps sideways. */
  completedRows: 7,
  /** Gap between the completed blocks and the first future-term container. */
  sectionGap: 140,
  /** Future-term calendar container width. */
  columnWidth: 560,
  /** Gap between adjacent future-term containers (room for prereq edges). */
  columnGap: 120,
  /** Height of an enabled future term (header + embedded week calendar). */
  futureEnabledHeight: 560,
  /** Height of a disabled/not-yet-enabled future term (header only). */
  futureDisabledHeight: 96,
  /** Smallest size a future-term calendar can be resized to. */
  futureMinWidth: 380,
  futureMinHeight: 360,
  bottomPadding: 28,
} as const;

const rowStride = PLANNER_LAYOUT.nodeHeight + PLANNER_LAYOUT.rowGap;
const innerStrideX = PLANNER_LAYOUT.nodeWidth + PLANNER_LAYOUT.innerGapX;

/** Smallest size a future-term calendar node can be resized to (see `PlannerCanvas`). */
export const PLANNER_FUTURE_MIN_SIZE = {
  width: PLANNER_LAYOUT.futureMinWidth,
  height: PLANNER_LAYOUT.futureMinHeight,
} as const;

/** Collect the direct prerequisite course codes referenced anywhere in a tree. */
function collectPrereqCodes(node: CoursePrereqNode | undefined, out: Set<string>): void {
  if (!node) return;
  if (node.type === "course" && node.code) out.add(node.code);
  for (const child of node.children ?? []) collectPrereqCodes(child, out);
}

function courseTitle(cache: DataCache | null, code: string): string {
  return cache?.getCourse(code)?.title ?? "";
}

interface CompletedEntry {
  code: string;
  term: string;
}

/** Where a course sits, for prereq-edge wiring. `order` grows left→right. */
interface Placement {
  id: string;
  order: number;
}

/**
 * Build the degree-planner graph. Completed courses are grouped by the term they
 * were taken in and laid out left→right in chronological order: each term is a
 * passive, labelled background block, and its courses sit on top as free,
 * top-level, freely-draggable nodes (not children of the block, so they can be
 * dragged anywhere). Blocks share a height; shorter terms are vertically centred
 * within it. Future (generated) terms render as React Flow container nodes,
 * placed to the right of the completed blocks, each embedding that term's week
 * calendar (drawn by the node component from the retained schedule). Prerequisite
 * edges point from a prereq to the course that needs it, always flowing left→
 * right: a completed course links to a later completed course, and every course a
 * future term schedules pulls an in-edge from each of its prerequisites' nodes
 * (an earlier completed chip or an earlier term's calendar container) into that
 * term's calendar node. Edges are deduped, so shared prereqs and multiple courses
 * supplied by the same earlier term collapse to one edge; same-term and self
 * links draw nothing. User-dragged positions (`positions`) override the automatic
 * layout per id.
 */
export function buildPlannerGraph(input: BuildPlannerGraphInput): PlannerGraph {
  const { cache, positions, sizes } = input;
  const canonical = (code: string) => cache?.resolveToCanonical(code) ?? code;
  const at = (id: string, fallback: { x: number; y: number }) => positions?.[id] ?? fallback;
  /** Saved future-term size (clamped to the minimum), else the automatic default. */
  const sizeOf = (id: string, fallbackWidth: number, fallbackHeight: number) => {
    const saved = sizes?.[id];
    if (!saved) return { width: fallbackWidth, height: fallbackHeight };
    return {
      width: Math.max(saved.width, PLANNER_LAYOUT.futureMinWidth),
      height: Math.max(saved.height, PLANNER_LAYOUT.futureMinHeight),
    };
  };

  // 1. Group completed courses by term in chronological order, deduping by
  //    canonical code so a retaken/renumbered course appears once (kept in the
  //    first term it shows up in). Empty terms produce no block.
  const seenCompleted = new Set<string>();
  const completedGroups: { label: string; entries: CompletedEntry[] }[] = [];
  for (const term of input.completedTerms) {
    const entries: CompletedEntry[] = [];
    for (const code of term.courses) {
      const key = canonical(code);
      if (seenCompleted.has(key)) continue;
      seenCompleted.add(key);
      entries.push({ code, term: term.label });
    }
    if (entries.length > 0) completedGroups.push({ label: term.label, entries });
  }

  // 2. Placement map (canonical code → node id + left→right order). Completed
  //    courses take their term's chronological index; future terms follow after
  //    all completed blocks. A future term's courses all resolve to that term's
  //    single calendar container, so a prereq satisfied by an earlier planned
  //    term links from that term's calendar node. An edge is drawn from a prereq
  //    to a target only when the prereq's order is smaller, so links point
  //    forward.
  const placementByCanonical = new Map<string, Placement>();
  for (let gi = 0; gi < completedGroups.length; gi++) {
    for (const entry of completedGroups[gi].entries) {
      const key = canonical(entry.code);
      placementByCanonical.set(key, { id: `completed::${key}`, order: gi });
    }
  }
  const completedBase = completedGroups.length;
  for (let termIndex = 0; termIndex < input.futureTerms.length; termIndex++) {
    const term = input.futureTerms[termIndex];
    const containerId = `container-future-${term.termId}`;
    for (const code of term.courses) {
      const key = canonical(code);
      if (placementByCanonical.has(key)) continue;
      placementByCanonical.set(key, {
        id: containerId,
        order: completedBase + termIndex,
      });
    }
  }

  const bandNodes: PlannerFlowNode<PlannerBandData>[] = [];
  const courseNodes: PlannerFlowNode<PlannerNodeData>[] = [];
  const edges: PlannerFlowEdge[] = [];
  const edgeKeys = new Set<string>();

  /** Draw a deduped edge from every prereq that lands in an earlier column than `target`. */
  const linkPrereqs = (
    targetId: string,
    targetOrder: number,
    prereqTree: CoursePrereqNode | undefined,
  ) => {
    const prereqCodes = new Set<string>();
    collectPrereqCodes(prereqTree, prereqCodes);
    for (const rawPrereq of prereqCodes) {
      const placement = placementByCanonical.get(canonical(rawPrereq));
      if (!placement || placement.order >= targetOrder) continue;
      if (placement.id === targetId) continue;
      const edgeId = `${placement.id}->${targetId}`;
      if (edgeKeys.has(edgeId)) continue;
      edgeKeys.add(edgeId);
      edges.push({ id: edgeId, source: placement.id, target: targetId });
    }
  };

  // 3. Completed term blocks: one passive background band per term laid out
  //    left→right, with its courses stacked on top as free nodes. Blocks share a
  //    height (tallest term); shorter terms are vertically centred within it.
  //    A term wraps into extra sub-columns once it exceeds `completedRows`.
  const rows = PLANNER_LAYOUT.completedRows;
  const colRowsOf = (n: number) => Math.min(n, rows);
  let maxColRows = 0;
  for (const group of completedGroups) {
    maxColRows = Math.max(maxColRows, colRowsOf(group.entries.length));
  }
  const bandHeight =
    completedGroups.length > 0
      ? PLANNER_LAYOUT.bandHeaderHeight +
        maxColRows * PLANNER_LAYOUT.nodeHeight +
        (maxColRows - 1) * PLANNER_LAYOUT.rowGap +
        PLANNER_LAYOUT.bandPadBottom
      : 0;

  let height = bandHeight;
  let xCursor = 0;
  for (let gi = 0; gi < completedGroups.length; gi++) {
    const group = completedGroups[gi];
    const count = group.entries.length;
    const subCols = Math.ceil(count / rows);
    const bandWidth =
      2 * PLANNER_LAYOUT.bandPadX +
      subCols * PLANNER_LAYOUT.nodeWidth +
      (subCols - 1) * PLANNER_LAYOUT.innerGapX;
    const bandX = xCursor;
    const bandId = `completed-band-${gi}`;

    bandNodes.push({
      id: bandId,
      type: "termBand",
      position: at(bandId, { x: bandX, y: 0 }),
      data: { label: group.label, kind: "completed", enabled: true, courseCount: count },
      draggable: false,
      selectable: false,
      zIndex: 0,
      width: bandWidth,
      height: bandHeight,
      style: { width: bandWidth, height: bandHeight },
    });

    const centerOffset = ((maxColRows - colRowsOf(count)) / 2) * rowStride;
    for (let k = 0; k < count; k++) {
      const entry = group.entries[k];
      const subCol = Math.floor(k / rows);
      const row = k % rows;
      const id = `completed::${canonical(entry.code)}`;
      const pos = at(id, {
        x: bandX + PLANNER_LAYOUT.bandPadX + subCol * innerStrideX,
        y: PLANNER_LAYOUT.bandHeaderHeight + centerOffset + row * rowStride,
      });
      height = Math.max(height, pos.y + PLANNER_LAYOUT.nodeHeight + PLANNER_LAYOUT.bottomPadding);
      courseNodes.push({
        id,
        type: "course",
        position: pos,
        data: {
          code: entry.code,
          title: courseTitle(cache, entry.code),
          status: "completed",
          term: entry.term,
        },
        draggable: true,
        selectable: true,
        zIndex: 1,
        width: PLANNER_LAYOUT.nodeWidth,
        height: PLANNER_LAYOUT.nodeHeight,
      });

      linkPrereqs(id, gi, cache?.getCourse(entry.code)?.prerequisites);
    }

    xCursor += bandWidth + PLANNER_LAYOUT.bandGap;
  }
  const completedWidth = xCursor > 0 ? xCursor - PLANNER_LAYOUT.bandGap : 0;

  // 4. Future terms: one calendar container each, to the right of the completed
  //    blocks. Every course the term schedules is drawn inside the node's
  //    embedded week calendar (by the node component), so the only edges here are
  //    the prerequisite links flowing into each term's calendar from earlier
  //    completed courses or earlier planned terms.
  const futureStartX = completedWidth > 0 ? completedWidth + PLANNER_LAYOUT.sectionGap : 0;

  let futureCursor = futureStartX;
  for (let termIndex = 0; termIndex < input.futureTerms.length; termIndex++) {
    const term = input.futureTerms[termIndex];
    const containerId = `container-future-${term.termId}`;
    // Enabled terms honor a saved (resized) size; disabled terms are a fixed,
    // header-only strip at the default width.
    const { width: containerWidth, height: containerHeight } = term.enabled
      ? sizeOf(containerId, PLANNER_LAYOUT.columnWidth, PLANNER_LAYOUT.futureEnabledHeight)
      : { width: PLANNER_LAYOUT.columnWidth, height: PLANNER_LAYOUT.futureDisabledHeight };
    height = Math.max(height, containerHeight);

    bandNodes.push({
      id: containerId,
      type: "futureTerm",
      position: at(containerId, { x: futureCursor, y: 0 }),
      data: {
        label: term.label,
        kind: "future",
        termId: term.termId,
        enabled: term.enabled,
        courseCount: term.courses.length,
        status: term.status,
      },
      draggable: true,
      selectable: false,
      zIndex: 0,
      width: containerWidth,
      height: containerHeight,
      style: { width: containerWidth, height: containerHeight },
    });

    // Prerequisite in-edges: for every course scheduled this term, link from each
    // prerequisite that lands in an earlier term (a completed course chip or an
    // earlier term's calendar). `linkPrereqs` dedupes, so shared prereqs and
    // multiple courses provided by the same earlier term collapse to one edge.
    const targetOrder = completedBase + termIndex;
    for (const code of term.courses) {
      linkPrereqs(containerId, targetOrder, cache?.getCourse(code)?.prerequisites);
    }

    futureCursor += containerWidth + PLANNER_LAYOUT.columnGap;
  }

  const futureRight = input.futureTerms.length > 0 ? futureCursor - PLANNER_LAYOUT.columnGap : 0;
  const width = Math.max(completedWidth, futureRight);
  return { bandNodes, courseNodes, edges, width: Math.max(width, 0), height };
}
