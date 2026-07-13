import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import {
  getLanguageVariant,
  normalizeCourseCode,
  parseCourseCode,
} from "@uoplan/domain/utils/courseUtils";
import type { PrereqContext } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PrereqNodeStatus = "met" | "missing" | "unknown";

export const PREREQ_GRAPH_FAN_OUT_LIMIT = 4;

export type PrereqGraphTr = (id: string, values?: Record<string, string | number>) => string;

/** Base fields shared by all graph nodes. */
interface PrereqGraphNodeBase {
  id: string;
  status: PrereqNodeStatus;
  rank: number;
  lane: number;
  programs?: string[];
  programLabel?: string;
}

export interface PrereqGraphCourseNode extends PrereqGraphNodeBase {
  kind: "course";
  role: "prerequisite" | "target";
  code: NormalizedCourseCode;
  resolvable: boolean;
}

export interface PrereqGraphGateNode extends PrereqGraphNodeBase {
  kind: "and_gate" | "or_gate";
  label: string;
}

export interface PrereqGraphSemanticNode extends PrereqGraphNodeBase {
  kind: "semantic";
  label: string;
  disclosureText?: string;
}

interface PrereqGraphAggregateChildBase {
  kind: "course" | "requirement";
  status: PrereqNodeStatus;
}

export interface PrereqGraphAggregateCourseChild extends PrereqGraphAggregateChildBase {
  kind: "course";
  code: NormalizedCourseCode;
  resolvable: boolean;
  programLabel?: string;
}

export interface PrereqGraphAggregateRequirementChild extends PrereqGraphAggregateChildBase {
  kind: "requirement";
  label: string;
}

export type PrereqGraphAggregateChild =
  | PrereqGraphAggregateCourseChild
  | PrereqGraphAggregateRequirementChild;

export interface PrereqGraphAggregateNode extends PrereqGraphNodeBase {
  kind: "aggregate";
  mode: "any" | "all";
  label: string;
  children: PrereqGraphAggregateChild[];
}

export type PrereqGraphNode =
  | PrereqGraphCourseNode
  | PrereqGraphGateNode
  | PrereqGraphSemanticNode
  | PrereqGraphAggregateNode;

export interface PrereqGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  status: PrereqNodeStatus;
}

export interface PrereqGraph {
  rootId: string;
  nodes: PrereqGraphNode[];
  edges: PrereqGraphEdge[];
  rankCount: number;
  laneCount: number;
  a11yDescription: string;
}

export interface BuildPrereqGraphOptions {
  courseCode: NormalizedCourseCode;
  prereqRoot: CoursePrereqNode;
  plannerContext: PrereqContext | null;
  cache: DataCache | null;
  tr: PrereqGraphTr;
  fanOutLimit?: number;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildPrereqGraph(options: BuildPrereqGraphOptions): PrereqGraph {
  const { courseCode, prereqRoot, plannerContext, cache, tr, fanOutLimit } = options;
  const limit = fanOutLimit ?? PREREQ_GRAPH_FAN_OUT_LIMIT;

  const nodes: PrereqGraphNode[] = [];
  const edges: PrereqGraphEdge[] = [];
  let laneCounter = 0;

  // Recursively build subgraph and return the node id + status of root of that subgraph
  function processNode(
    node: CoursePrereqNode,
    path: string,
  ): { id: string; status: PrereqNodeStatus } {
    const hasPrograms = node.programs && node.programs.length > 0;

    switch (node.type) {
      case "course":
        return processCourseNode(node, path);
      case "and_group":
        return processGateNode(node, path, "and_gate", limit, hasPrograms);
      case "or_group":
        return processGateNode(node, path, "or_gate", limit, hasPrograms);
      case "non_course":
        return processNonCourseNode(node, path, hasPrograms);
      default:
        return processNonCourseNode(node, path, hasPrograms);
    }
  }

  function processCourseNode(
    node: CoursePrereqNode,
    path: string,
  ): { id: string; status: PrereqNodeStatus } {
    const nodeId = `prereq-course-${path}`;
    const rawCode = node.code ?? "";
    const normalized = normalizeCourseCode(rawCode);
    const resolvable = isResolvableCourse(rawCode, cache);

    const courseStatus = computeCourseTakenStatus(rawCode, plannerContext);
    const programStatus = computeProgramStatus(node, plannerContext);
    const status =
      programStatus === "met" ? (resolvable ? courseStatus : "unknown") : programStatus;

    const lane = laneCounter++;
    const graphNode: PrereqGraphCourseNode = {
      id: nodeId,
      kind: "course",
      role: "prerequisite",
      code: normalized,
      resolvable,
      status,
      rank: 0, // will be adjusted in layout pass
      lane,
      ...(node.programs?.length
        ? { programs: node.programs, programLabel: programLabel(node, tr) }
        : {}),
    };
    nodes.push(graphNode);
    return { id: nodeId, status };
  }

  function processGateNode(
    node: CoursePrereqNode,
    path: string,
    kind: "and_gate" | "or_gate",
    fanLimit: number,
    hasPrograms: boolean | undefined,
  ): { id: string; status: PrereqNodeStatus } {
    const nodeId = `prereq-${kind === "and_gate" ? "and" : "or"}-${path}`;
    const children = node.children ?? [];

    if (children.length > fanLimit) {
      return processAggregateFromGate(node, path, kind, hasPrograms);
    }

    // Process children
    const childResults: Array<{ id: string; status: PrereqNodeStatus }> = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const childPath = `${path}.${i}`;
      const result = processNode(child, childPath);
      childResults.push(result);
    }

    // Compute Kleene status (programs predicate takes priority)
    const status = gateStatusFromChildren(
      node,
      plannerContext,
      kind,
      childResults.map((r) => r.status),
    );

    const childLanes = childResults.map((r) => {
      const n = nodes.find((nd) => nd.id === r.id);
      return n ? n.lane : 0;
    });
    const avgLane =
      childLanes.length > 0 ? childLanes.reduce((a, b) => a + b, 0) / childLanes.length : 0;

    const gateNode: PrereqGraphGateNode = {
      id: nodeId,
      kind,
      status,
      rank: 0,
      lane: avgLane,
      label: withProgramQualifier(
        tr(kind === "and_gate" ? "prereqGraph.gate.and" : "prereqGraph.gate.or"),
        node,
        tr,
      ),
      ...(hasPrograms && node.programs
        ? { programs: node.programs, programLabel: programLabel(node, tr) }
        : {}),
    };
    nodes.push(gateNode);

    // Create edges from children to gate
    for (const child of childResults) {
      const edgeId = `edge-${child.id}-${nodeId}`;
      edges.push({
        id: edgeId,
        sourceId: child.id,
        targetId: nodeId,
        status: child.status,
      });
    }

    return { id: nodeId, status };
  }

  function processAggregateFromGate(
    node: CoursePrereqNode,
    path: string,
    kind: "and_gate" | "or_gate",
    hasPrograms: boolean | undefined,
  ): { id: string; status: PrereqNodeStatus } {
    const mode: "any" | "all" = kind === "or_gate" ? "any" : "all";
    const nodeId = `prereq-aggregate-${path}`;
    const children = node.children ?? [];

    const aggChildren = children.map((child): PrereqGraphAggregateChild => {
      const status = computeNodeStatus(child, plannerContext, cache);
      if (child.type === "course") {
        const rawCode = child.code ?? "";
        return {
          kind: "course",
          code: normalizeCourseCode(rawCode),
          status,
          resolvable: isResolvableCourse(rawCode, cache),
          ...(child.programs?.length ? { programLabel: programLabel(child, tr) } : {}),
        };
      }
      return {
        kind: "requirement",
        label: buildNodeSummary(child, tr),
        status,
      };
    });

    // Compute status from children (programs predicate takes priority)
    const status = gateStatusFromChildren(
      node,
      plannerContext,
      kind,
      aggChildren.map((c) => c.status),
    );

    const label = withProgramQualifier(
      tr(mode === "any" ? "prereqGraph.aggregate.any" : "prereqGraph.aggregate.all"),
      node,
      tr,
    );
    const lane = laneCounter++;

    const aggNode: PrereqGraphAggregateNode = {
      id: nodeId,
      kind: "aggregate",
      mode,
      label,
      children: aggChildren,
      status,
      rank: 0,
      lane,
      ...(hasPrograms && node.programs
        ? { programs: node.programs, programLabel: programLabel(node, tr) }
        : {}),
    };
    nodes.push(aggNode);
    return { id: nodeId, status };
  }

  function processNonCourseNode(
    node: CoursePrereqNode,
    path: string,
    hasPrograms: boolean | undefined,
  ): { id: string; status: PrereqNodeStatus } {
    const nodeId = `prereq-semantic-${path}`;
    const credits = node.credits;

    // Non-course without credits => always unknown (opaque)
    if (credits == null) {
      const label = withProgramQualifier(buildSemanticLabel(node, tr), node, tr);
      const disclosureText = node.kind === undefined && node.text ? node.text : undefined;
      const programStatus = computeProgramStatus(node, plannerContext);
      const status: PrereqNodeStatus = programStatus === "met" ? "unknown" : programStatus;
      // Even with context, non-course without credits is unknown for the graph
      // (scheduler may treat soft kinds as satisfiable, but graph shows unknown)

      const lane = laneCounter++;
      const semanticNode: PrereqGraphSemanticNode = {
        id: nodeId,
        kind: "semantic",
        label,
        status,
        rank: 0,
        lane,
        ...(disclosureText ? { disclosureText } : {}),
        ...(hasPrograms && node.programs
          ? { programs: node.programs, programLabel: programLabel(node, tr) }
          : {}),
      };
      nodes.push(semanticNode);
      return { id: nodeId, status };
    }

    // Non-course WITH credits: computable
    const label = withProgramQualifier(buildCreditSemanticLabel(node, tr), node, tr);
    const status = computeNonCourseStatus(node, plannerContext);

    const lane = laneCounter++;
    const semanticNode: PrereqGraphSemanticNode = {
      id: nodeId,
      kind: "semantic",
      label,
      status,
      rank: 0,
      lane,
      ...(hasPrograms && node.programs
        ? { programs: node.programs, programLabel: programLabel(node, tr) }
        : {}),
    };
    nodes.push(semanticNode);
    return { id: nodeId, status };
  }

  // --- Main build logic ---
  const rootResult = processNode(prereqRoot, "root");

  // Create target node
  const targetId = "prereq-target";
  const targetNode: PrereqGraphCourseNode = {
    id: targetId,
    kind: "course",
    role: "target",
    code: courseCode,
    resolvable: true,
    status: rootResult.status,
    rank: 0,
    lane: 0,
  };
  nodes.push(targetNode);

  // Edge from root subgraph to target
  const targetEdgeId = `edge-${rootResult.id}-${targetId}`;
  edges.push({
    id: targetEdgeId,
    sourceId: rootResult.id,
    targetId,
    status: rootResult.status,
  });

  // --- Layout: assign ranks ---
  assignRanksAndLanes(nodes, edges, targetId);

  // --- Compute dimensions ---
  const rankCount = Math.max(...nodes.map((n) => n.rank)) + 1;
  const laneCount = laneCounter;

  // --- A11y description ---
  const a11yDescription = buildA11yDescription(prereqRoot, plannerContext, cache, tr);

  return {
    rootId: targetId,
    nodes,
    edges,
    rankCount,
    laneCount,
    a11yDescription,
  };
}

// ---------------------------------------------------------------------------
// Kleene three-state logic
// ---------------------------------------------------------------------------

function computeAndStatus(statuses: PrereqNodeStatus[]): PrereqNodeStatus {
  if (statuses.some((s) => s === "missing")) return "missing";
  if (statuses.every((s) => s === "met")) return "met";
  return "unknown";
}

function computeOrStatus(statuses: PrereqNodeStatus[]): PrereqNodeStatus {
  if (statuses.some((s) => s === "met")) return "met";
  if (statuses.every((s) => s === "missing")) return "missing";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Credit evaluation (mirrors evaluator.ts logic for graph display)
// ---------------------------------------------------------------------------

function collectCourseCodes(node: CoursePrereqNode, codes: Set<NormalizedCourseCode>): void {
  if (node.type === "course" && node.code) {
    const target = normalizeCourseCode(node.code);
    const variant = getLanguageVariant(target);
    codes.add(target);
    if (variant !== null) codes.add(variant);
  }
  for (const child of node.children ?? []) {
    collectCourseCodes(child, codes);
  }
}

function computeCreditsForNonCourse(node: CoursePrereqNode, ctx: PrereqContext): number {
  // Scoped children
  if (node.children?.length) {
    const codes = new Set<NormalizedCourseCode>();
    for (const child of node.children) {
      collectCourseCodes(child, codes);
    }
    if (codes.size === 0) return 0;
    return ctx.taken.reduce(
      (sum, course) => sum + (codes.has(course.code) ? course.credits : 0),
      0,
    );
  }

  // DisciplineLevels
  if (node.disciplineLevels?.length) {
    let sum = 0;
    for (const t of ctx.taken) {
      for (const dl of node.disciplineLevels) {
        if (dl.discipline.toUpperCase() !== t.discipline.toUpperCase()) continue;
        const allowed = dl.levels;
        if (!allowed?.length) {
          sum += t.credits;
          break;
        }
        if (t.level != null && allowed.includes(t.level)) {
          sum += t.credits;
          break;
        }
      }
    }
    return sum;
  }

  // Both disciplines and levels
  if (node.disciplines?.length && node.levels?.length) {
    let sum = 0;
    const dset = new Set(node.disciplines.map((d) => d.toUpperCase()));
    const allowed = new Set(node.levels);
    for (const t of ctx.taken) {
      if (!dset.has(t.discipline.toUpperCase())) continue;
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // Only levels
  if (node.levels?.length && (!node.disciplines || node.disciplines.length === 0)) {
    const allowed = new Set(node.levels);
    let sum = 0;
    for (const t of ctx.taken) {
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // Only disciplines
  if (node.disciplines?.length) {
    return node.disciplines.reduce(
      (acc, d) => acc + (ctx.disciplineCredits[d.toUpperCase()] ?? 0),
      0,
    );
  }

  // Fallback: total credits
  return ctx.totalCredits;
}

// ---------------------------------------------------------------------------
// Shared status helpers (used by both visual topology and accessibility)
// ---------------------------------------------------------------------------

/** Compute taken/met status of a single course node. */
function computeCourseTakenStatus(rawCode: string, ctx: PrereqContext | null): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const normalized = normalizeCourseCode(rawCode);
  if (!parseCourseCode(rawCode)) return "unknown";
  const variant = getLanguageVariant(normalized);
  const found = ctx.taken.some(
    (c) => c.code === normalized || (variant !== null && c.code === variant),
  );
  return found ? "met" : "missing";
}

function isResolvableCourse(rawCode: string, cache: DataCache | null): boolean {
  if (parseCourseCode(rawCode) === null) return false;
  if (cache === null) return true;
  return cache.getCourse(normalizeCourseCode(rawCode)) !== undefined;
}

function computeProgramStatus(node: CoursePrereqNode, ctx: PrereqContext | null): PrereqNodeStatus {
  if (!node.programs?.length) return "met";
  if (ctx === null || ctx.studentPrograms.length === 0) return "unknown";
  return node.programs.some((program) => ctx.studentPrograms.includes(program)) ? "met" : "missing";
}

/**
 * Compute gate status from already-resolved child statuses, applying the
 * programs predicate before Kleene logic.
 */
function gateStatusFromChildren(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  kind: "and_gate" | "or_gate",
  childStatuses: PrereqNodeStatus[],
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  return kind === "and_gate" ? computeAndStatus(childStatuses) : computeOrStatus(childStatuses);
}

/**
 * Compute status for a non_course credit node: applies the programs predicate then
 * evaluates earned credits against the required threshold.
 * Returns "unknown" for opaque nodes (no credits) or when context is absent.
 */
function computeNonCourseStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  if (node.credits == null) return "unknown";
  const earned = computeCreditsForNonCourse(node, ctx);
  return earned >= node.credits ? "met" : "missing";
}

function computeNodeStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
): PrereqNodeStatus {
  switch (node.type) {
    case "course": {
      const programStatus = computeProgramStatus(node, ctx);
      return programStatus === "met"
        ? isResolvableCourse(node.code ?? "", cache)
          ? computeCourseTakenStatus(node.code ?? "", ctx)
          : "unknown"
        : programStatus;
    }
    case "and_group":
      return gateStatusFromChildren(
        node,
        ctx,
        "and_gate",
        (node.children ?? []).map((child) => computeNodeStatus(child, ctx, cache)),
      );
    case "or_group":
      return gateStatusFromChildren(
        node,
        ctx,
        "or_gate",
        (node.children ?? []).map((child) => computeNodeStatus(child, ctx, cache)),
      );
    case "non_course":
      return computeNonCourseStatus(node, ctx);
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Semantic labels
// ---------------------------------------------------------------------------

function buildSemanticLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  if (node.kind !== undefined) {
    switch (node.kind) {
      case "permission":
        return tr("prereqGraph.kind.permission");
      case "audition":
        return tr("prereqGraph.kind.audition");
      case "language":
        return tr("prereqGraph.kind.language");
      case "equivalent":
        return tr("prereqGraph.kind.equivalent");
      case "highschool":
        return tr("prereqGraph.kind.highschool");
      case "standing":
        return tr("prereqGraph.kind.standing");
      case "topic":
        return tr("prereqGraph.kind.topic");
      case "coursework":
        return tr("prereqGraph.kind.coursework");
      case "knowledge":
        return tr("prereqGraph.kind.knowledge");
      case "recommended":
        return tr("prereqGraph.kind.recommended");
    }
  }

  // Unclassified
  return tr("prereqGraph.kind.unclassified");
}

function buildCreditSemanticLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  const credits = node.credits ?? 0;

  if (node.children?.length) {
    return tr("prereqGraph.semantic.creditTotal", { credits });
  }

  if (node.disciplineLevels?.length) {
    const desc = node.disciplineLevels
      .map((dl) => {
        const levels = dl.levels?.join(", ") ?? "";
        return levels ? `${dl.discipline} ${levels}` : dl.discipline;
      })
      .join("; ");
    return tr("prereqGraph.semantic.disciplineLevels", { credits, description: desc });
  }

  if (node.disciplines?.length && node.levels?.length) {
    return tr("prereqGraph.semantic.disciplineLevels", {
      credits,
      description: `${node.disciplines.join(", ")} ${node.levels.join(", ")}`,
    });
  }

  if (node.levels?.length) {
    return tr("prereqGraph.semantic.levels", { credits, levels: node.levels.join(", ") });
  }

  if (node.disciplines?.length) {
    return tr("prereqGraph.semantic.disciplines", {
      credits,
      disciplines: node.disciplines.join(", "),
    });
  }

  return tr("prereqGraph.semantic.creditTotal", { credits });
}

function programLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  return tr("prereqGraph.programs", { programs: node.programs?.join(", ") ?? "" });
}

function withProgramQualifier(label: string, node: CoursePrereqNode, tr: PrereqGraphTr): string {
  if (!node.programs?.length) return label;
  return tr("prereqGraph.programQualifier", {
    label,
    programs: node.programs.join(", "),
  });
}

function buildNodeSummary(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  let label: string;
  switch (node.type) {
    case "course":
      label = node.code ?? "";
      break;
    case "and_group":
      label = tr("prereqGraph.summary.andGroup", {
        children: (node.children ?? []).map((child) => buildNodeSummary(child, tr)).join("; "),
      });
      break;
    case "or_group":
      label = tr("prereqGraph.summary.orGroup", {
        children: (node.children ?? []).map((child) => buildNodeSummary(child, tr)).join("; "),
      });
      break;
    case "non_course":
      label =
        node.credits == null ? buildSemanticLabel(node, tr) : buildCreditSemanticLabel(node, tr);
      break;
    default:
      label = "";
  }
  return withProgramQualifier(label, node, tr);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function assignRanksAndLanes(
  nodes: PrereqGraphNode[],
  edges: PrereqGraphEdge[],
  targetId: string,
): void {
  // Build adjacency: for each node, which nodes feed into it (sources)
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();
  for (const edge of edges) {
    const incoming = incomingMap.get(edge.targetId) ?? [];
    incoming.push(edge.sourceId);
    incomingMap.set(edge.targetId, incoming);

    const outgoing = outgoingMap.get(edge.sourceId) ?? [];
    outgoing.push(edge.targetId);
    outgoingMap.set(edge.sourceId, outgoing);
  }

  // Compute rank: BFS from target backwards (target gets max rank)
  const rankFromTarget = new Map<string, number>();
  const queue: string[] = [targetId];
  rankFromTarget.set(targetId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentRank = rankFromTarget.get(current)!;
    const sources = incomingMap.get(current) ?? [];
    for (const src of sources) {
      const existingRank = rankFromTarget.get(src);
      const newRank = currentRank + 1;
      if (existingRank === undefined || newRank > existingRank) {
        rankFromTarget.set(src, newRank);
        queue.push(src);
      }
    }
  }

  // Find max rank to invert (leaves get rank 0, target gets max)
  const maxRank = Math.max(...rankFromTarget.values(), 0);

  // Assign ranks
  for (const node of nodes) {
    const fromTarget = rankFromTarget.get(node.id);
    if (fromTarget !== undefined) {
      node.rank = maxRank - fromTarget;
    } else {
      // Nodes not connected (shouldn't happen, but safe default)
      node.rank = 0;
    }
  }

  // Recompute lanes for gate nodes and target based on children average
  for (const node of nodes) {
    if (node.kind === "and_gate" || node.kind === "or_gate") {
      const sources = incomingMap.get(node.id) ?? [];
      if (sources.length > 0) {
        const childLanes = sources
          .map((s) => nodes.find((n) => n.id === s))
          .filter((n) => n !== undefined)
          .map((n) => n.lane);
        if (childLanes.length > 0) {
          node.lane = childLanes.reduce((a, b) => a + b, 0) / childLanes.length;
        }
      }
    }
  }

  // Target lane: average of its incoming sources
  const targetNode = nodes.find((n) => n.id === targetId);
  if (targetNode) {
    const sources = incomingMap.get(targetId) ?? [];
    if (sources.length > 0) {
      const childLanes = sources
        .map((s) => nodes.find((n) => n.id === s))
        .filter((n) => n !== undefined)
        .map((n) => n.lane);
      if (childLanes.length > 0) {
        targetNode.lane = childLanes.reduce((a, b) => a + b, 0) / childLanes.length;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Accessibility description
// ---------------------------------------------------------------------------

function buildA11yDescription(
  prereqRoot: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  tr: PrereqGraphTr,
): string {
  return describeNode(prereqRoot, ctx, cache, tr);
}

function describeNode(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  tr: PrereqGraphTr,
): string {
  let description: string;
  switch (node.type) {
    case "course": {
      const code = node.code ?? "";
      const status = describeCourseStatus(node, ctx, cache);
      description = tr("prereqGraph.a11y.course", {
        code,
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "and_group": {
      const childDescs = (node.children ?? []).map((child) => describeNode(child, ctx, cache, tr));
      const status = describeGateStatus(node, ctx, cache, "and");
      description = tr("prereqGraph.a11y.andGroup", {
        children: childDescs.join("; "),
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "or_group": {
      const childDescs = (node.children ?? []).map((child) => describeNode(child, ctx, cache, tr));
      const status = describeGateStatus(node, ctx, cache, "or");
      description = tr("prereqGraph.a11y.orGroup", {
        children: childDescs.join("; "),
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "non_course": {
      const label =
        node.credits != null ? buildCreditSemanticLabel(node, tr) : buildSemanticLabel(node, tr);
      const status = computeNonCourseStatus(node, ctx);
      description = tr("prereqGraph.a11y.semantic", {
        label,
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    default:
      description = "";
  }
  return withProgramQualifier(description, node, tr);
}

function describeCourseStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
): PrereqNodeStatus {
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  if (!isResolvableCourse(node.code ?? "", cache)) return "unknown";
  return computeCourseTakenStatus(node.code ?? "", ctx);
}

function describeGateStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  kind: "and" | "or",
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const gateKind: "and_gate" | "or_gate" = kind === "and" ? "and_gate" : "or_gate";
  const children = node.children ?? [];
  const statuses = children.map((child) => describeChildStatus(child, ctx, cache));
  return gateStatusFromChildren(node, ctx, gateKind, statuses);
}

function describeChildStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext,
  cache: DataCache | null,
): PrereqNodeStatus {
  switch (node.type) {
    case "course":
      return describeCourseStatus(node, ctx, cache);
    case "and_group":
      return describeGateStatus(node, ctx, cache, "and");
    case "or_group":
      return describeGateStatus(node, ctx, cache, "or");
    case "non_course":
      return computeNonCourseStatus(node, ctx);
    default:
      return "unknown";
  }
}

function trPrereqStatus(status: PrereqNodeStatus, tr: PrereqGraphTr): string {
  switch (status) {
    case "met":
      return tr("prereqGraph.status.met");
    case "missing":
      return tr("prereqGraph.status.missing");
    default:
      return tr("prereqGraph.status.unknown");
  }
}
