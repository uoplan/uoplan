import { useCallback, useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { Edge, Node, NodeTypes, OnNodeDrag } from "@xyflow/react";
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

interface PlannerCanvasProps {
  graph: PlannerGraph;
  /** Persist a node's position after the user drags it. */
  onNodePositionCommit: (id: string, pos: { x: number; y: number }) => void;
  /** Clear manual positions, restoring the automatic layout. */
  onResetLayout: () => void;
}

export function PlannerCanvas({ graph, onNodePositionCommit, onResetLayout }: PlannerCanvasProps) {
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

  return (
    <div className={`${styles.canvas} uoplan-planner-canvas`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, minZoom: 0.3, maxZoom: 1.1 }}
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
