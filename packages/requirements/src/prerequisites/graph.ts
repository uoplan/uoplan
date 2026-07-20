import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { PREREQ_GRAPH_FAN_OUT_LIMIT } from "./graphTypes";
import type {
  BuildPrereqGraphOptions,
  PrereqGraph,
  PrereqGraphAggregateChild,
  PrereqGraphAggregateNode,
  PrereqGraphCourseNode,
  PrereqGraphEdge,
  PrereqGraphGateNode,
  PrereqGraphNode,
  PrereqGraphSemanticNode,
  PrereqNodeStatus,
} from "./graphTypes";
import {
  computeCourseTakenStatus,
  computeNodeStatus,
  computeNonCourseStatus,
  computeProgramStatus,
  gateStatusFromChildren,
  isResolvableCourse,
} from "./graphStatus";
import {
  buildCreditSemanticLabel,
  buildNodeSummary,
  buildSemanticLabel,
  programLabel,
  withProgramQualifier,
} from "./graphLabels";
import { assignRanksAndLanes } from "./graphLayout";
import { buildA11yDescription } from "./graphA11y";

export * from "./graphTypes";

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

  assignRanksAndLanes(nodes, edges, targetId);

  const rankCount = Math.max(...nodes.map((n) => n.rank)) + 1;
  const laneCount = laneCounter;
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
