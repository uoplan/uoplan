import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type {
  Edge,
  FitViewOptions,
  Node,
  NodeMouseHandler,
  NodeTypes,
  OnNodeDrag,
} from "@xyflow/react";
import type { PlannerGraph } from "../../lib/graphPlanner/buildPlannerGraph";
import { CourseNode } from "./CourseNode";
import { FutureTermNode } from "./FutureTermNode";
import { PlannerControls } from "./PlannerControls";
import { TermBandNode } from "./TermBandNode";
import styles from "./planner.module.css";
import "./planner-flow.css";

const nodeTypes: NodeTypes = {
  course: CourseNode,
  termBand: TermBandNode,
  futureTerm: FutureTermNode,
};

function toFlowNodes(graph: PlannerGraph): Node[] {
  // React Flow requires every parent to appear before its children in the array;
  // bands/containers precede all course nodes, so children always follow parents.
  const bands: Node[] = graph.bandNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    draggable: n.draggable,
    selectable: n.selectable,
    zIndex: n.zIndex,
    style: { width: n.width, height: n.height },
  }));
  const courses: Node[] = graph.courseNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    draggable: n.draggable,
    selectable: n.selectable,
    zIndex: n.zIndex,
    style: { width: n.width, height: n.height },
    ...(n.parentId ? { parentId: n.parentId, extent: n.extent } : {}),
  }));
  return [...bands, ...courses];
}

function toFlowEdges(graph: PlannerGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "default",
    focusable: false,
  }));
}

/**
 * Nodes to frame on the initial fit: the most recent completed term block (the
 * last "completed" band) plus every future/planning container. Framing just
 * these keeps the default view zoomed into the area the student actually plans
 * in, instead of shrinking to fit years of past terms. Their child course nodes
 * sit inside these bounds, so listing the bands/containers is enough. Returns an
 * empty array when there is nothing notable to focus, so the caller can fall
 * back to fitting the whole graph.
 */
function focusNodeIds(graph: PlannerGraph): { id: string }[] {
  const completed = graph.bandNodes.filter((n) => n.data.kind === "completed");
  const future = graph.bandNodes.filter((n) => n.data.kind === "future");
  const ids: { id: string }[] = [];
  const mostRecentCompleted = completed.at(-1);
  if (mostRecentCompleted) ids.push({ id: mostRecentCompleted.id });
  for (const container of future) ids.push({ id: container.id });
  return ids;
}

interface PlannerCanvasProps {
  graph: PlannerGraph;
  /** Persist a node's position after the user drags it. */
  onNodePositionCommit: (id: string, pos: { x: number; y: number }) => void;
  /** Clear manual positions, restoring the automatic layout. */
  onResetLayout: () => void;
  /** Focus a future term when its node is clicked. */
  onSelectTerm: (termId: string) => void;
}

export function PlannerCanvas({
  graph,
  onNodePositionCommit,
  onResetLayout,
  onSelectTerm,
}: PlannerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Re-seed the interactive node/edge state whenever the computed graph changes
  // (new terms, regeneration, or a persisted drag). Saved positions are already
  // baked into `graph`, so on-screen == persisted with no visible jump.
  useEffect(() => {
    setNodes(toFlowNodes(graph));
  }, [graph, setNodes]);
  useEffect(() => {
    setEdges(toFlowEdges(graph));
  }, [graph, setEdges]);

  const handleDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      onNodePositionCommit(node.id, { x: node.position.x, y: node.position.y });
    },
    [onNodePositionCommit],
  );

  // Clicking a future-term node focuses that term in the panel. Other node kinds
  // (completed bands, course chips) have no term to focus, so they're ignored.
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      if (node.type === "futureTerm") {
        const termId = (node.data as { termId?: string }).termId;
        if (termId) onSelectTerm(termId);
      }
    },
    [onSelectTerm],
  );

  // On the initial fit, frame the most recent term + future/planning terms rather
  // than the whole (potentially multi-year) graph. Falls back to fitting
  // everything when there is nothing notable to focus.
  const fitViewOptions = useMemo<FitViewOptions>(() => {
    const nodes = focusNodeIds(graph);
    return {
      padding: 0.3,
      minZoom: 0.3,
      maxZoom: 1.1,
      ...(nodes.length > 0 ? { nodes } : {}),
    };
  }, [graph]);

  return (
    <div className={`${styles.canvas} uoplan-planner-canvas`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleDragStop}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        selectionOnDrag={false}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <PlannerControls onResetLayout={onResetLayout} />
      </ReactFlow>
    </div>
  );
}
