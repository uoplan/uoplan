import { memo, useCallback, useEffect, useRef } from "react";
import type Graph from "graphology";
import Sigma from "sigma";
import type { ProfessorCoTeachingGraph, ProfessorGraphNode } from "@uoplan/core";
import {
  buildSigmaGraph,
  getNeighborIds,
  GRAPH_EDGE_COLOR,
  randomInitialPosition,
  type ProfessorEdgeAttributes,
  type ProfessorNodeAttributes,
} from "../../lib/graph/buildSigmaGraph";
import { drawProfessorNodeHover } from "../../lib/graph/drawProfessorNodeHover";
import { animateCameraToHighlightedNodes } from "../../lib/graph/fitViewportToNodes";
import { placeIsolatedNodes } from "../../lib/graph/placeIsolatedNodes";
import { runForceAtlas2Chunked } from "../../lib/graph/runForceAtlas2Chunked";
import { buildGraphContainerStyle } from "../../lib/graph/graphContainerStyle";
import { hexColorWithAlpha } from "../../lib/graph/colorWithAlpha";

function themeValue(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

type GraphTheme = {
  nodeDim: string;
  nodeActive: string;
  edgeFocus: string;
  labelColor: string;
  defaultNodeColor: string;
  labelFont: string;
};

function graphTheme(): GraphTheme {
  const textDim = themeValue("--app-text-dim");
  return {
    nodeDim: hexColorWithAlpha(textDim, 0.42),
    nodeActive: themeValue("--app-accent"),
    edgeFocus: hexColorWithAlpha(themeValue("--app-text-muted"), 0.14),
    labelColor: themeValue("--app-text"),
    defaultNodeColor: textDim,
    labelFont: themeValue("--app-font-body"),
  };
}

export type ProfessorGraphPhase = "layout" | "ready";

type ProfessorGraphViewProps = {
  data: ProfessorCoTeachingGraph;
  focusNodeId: string | null;
  previewNodeId?: string | null;
  onPhaseChange?: (phase: ProfessorGraphPhase) => void;
  onLayoutProgress?: (percent: number) => void;
  onNodeSelect?: (node: ProfessorGraphNode | null) => void;
};

function ensureFinitePositions(graph: Graph<ProfessorNodeAttributes, ProfessorEdgeAttributes>) {
  for (const nodeId of graph.nodes()) {
    const x = graph.getNodeAttribute(nodeId, "x");
    const y = graph.getNodeAttribute(nodeId, "y");
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const pos = randomInitialPosition(nodeId);
      graph.setNodeAttribute(nodeId, "x", pos.x);
      graph.setNodeAttribute(nodeId, "y", pos.y);
    }
  }
}

function ProfessorGraphViewInner({
  data,
  focusNodeId,
  previewNodeId = null,
  onPhaseChange,
  onLayoutProgress,
  onNodeSelect,
}: ProfessorGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma<ProfessorNodeAttributes, ProfessorEdgeAttributes> | null>(null);
  const graphRef = useRef<Graph<ProfessorNodeAttributes, ProfessorEdgeAttributes> | null>(null);
  const nodesByIdRef = useRef<Map<string, ProfessorGraphNode>>(new Map());
  const focusRef = useRef<string | null>(null);
  const neighborsRef = useRef<Set<string>>(new Set());
  const hoveredNodeRef = useRef<string | null>(null);
  const graphThemeRef = useRef<GraphTheme | null>(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onLayoutProgressRef = useRef(onLayoutProgress);

  onNodeSelectRef.current = onNodeSelect;
  onPhaseChangeRef.current = onPhaseChange;
  onLayoutProgressRef.current = onLayoutProgress;

  const nodeReducer = useCallback((node: string, attrs: ProfessorNodeAttributes) => {
    let next = attrs;

    const hovered = hoveredNodeRef.current;
    if (hovered === node) {
      const name = nodesByIdRef.current.get(node)?.displayName;
      next = { ...next, label: name ?? null };
    }

    const focus = focusRef.current;
    if (!focus) return next;
    const theme = graphThemeRef.current ?? graphTheme();
    if (node === focus) {
      return {
        ...next,
        color: theme.nodeActive,
        size: Math.min(next.size * 1.35, next.size + 1.5),
        zIndex: 2,
      };
    }
    if (neighborsRef.current.has(node)) {
      return { ...next, zIndex: 1 };
    }
    return { ...next, color: theme.nodeDim, zIndex: 0 };
  }, []);

  const edgeReducer = useCallback((edge: string, attrs: ProfessorEdgeAttributes) => {
    const focus = focusRef.current;
    const graph = graphRef.current;
    if (!focus || !graph) return attrs;
    const [source, target] = graph.extremities(edge);
    if (source === focus || target === focus) {
      const theme = graphThemeRef.current ?? graphTheme();
      return { ...attrs, color: theme.edgeFocus, size: Math.min(attrs.size * 1.4, 1.4) };
    }
    return { ...attrs, hidden: true };
  }, []);

  const applyFocusState = useCallback(
    (highlightId: string | null, options?: { animate?: boolean }) => {
      const graph = graphRef.current;
      const sigma = sigmaRef.current;
      if (!graph || !sigma) return;

      focusRef.current = highlightId;
      const neighbors: Set<string> =
        highlightId && graph.hasNode(highlightId) ? getNeighborIds(graph, highlightId) : new Set();
      neighborsRef.current = neighbors;

      sigma.refresh();

      if (highlightId && graph.hasNode(highlightId) && options?.animate !== false) {
        animateCameraToHighlightedNodes(sigma as never, highlightId, neighbors);
      }
    },
    [],
  );

  useEffect(() => {
    const highlightId = previewNodeId ?? focusNodeId;
    const animate = !previewNodeId && !!focusNodeId && highlightId === focusNodeId;
    applyFocusState(highlightId, { animate });
  }, [focusNodeId, previewNodeId, applyFocusState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    onPhaseChangeRef.current?.("layout");
    onLayoutProgressRef.current?.(0);

    const { graph, nodesById } = buildSigmaGraph(data);
    graphRef.current = graph;
    nodesByIdRef.current = nodesById;

    void (async () => {
      await runForceAtlas2Chunked(graph, {
        onProgress: (ratio) => {
          if (!cancelled) onLayoutProgressRef.current?.(Math.round(ratio * 100));
        },
        isCancelled: () => cancelled,
      });

      if (cancelled) return;

      ensureFinitePositions(graph);
      placeIsolatedNodes(graph, data.nodes);
      ensureFinitePositions(graph);

      if (cancelled) return;

      const theme = graphTheme();
      graphThemeRef.current = theme;

      const sigma = new Sigma(graph, container, {
        renderLabels: false,
        labelSize: 12,
        labelFont: theme.labelFont,
        labelColor: { color: theme.labelColor },
        defaultDrawNodeHover: drawProfessorNodeHover as never,
        defaultNodeColor: theme.defaultNodeColor,
        defaultEdgeColor: GRAPH_EDGE_COLOR,
        minEdgeThickness: 0.3,
        antiAliasingFeather: 0.5,
        hideEdgesOnMove: false,
        zIndex: true,
        nodeReducer,
        edgeReducer,
        minCameraRatio: 0.02,
        maxCameraRatio: 4,
      });
      sigmaRef.current = sigma;
      onLayoutProgressRef.current?.(100);
      onPhaseChangeRef.current?.("ready");

      const onEnterNode = ({ node }: { node: string }) => {
        hoveredNodeRef.current = node;
        sigma.refresh();
      };
      const onLeaveNode = () => {
        hoveredNodeRef.current = null;
        sigma.refresh();
      };
      const onClickNode = ({ node }: { node: string }) => {
        onNodeSelectRef.current?.(nodesById.get(node) ?? null);
      };
      sigma.on("enterNode", onEnterNode);
      sigma.on("leaveNode", onLeaveNode);
      sigma.on("clickNode", onClickNode);

      const onClickStage = () => {
        onNodeSelectRef.current?.(null);
      };
      sigma.on("clickStage", onClickStage);

      const initialHighlight = previewNodeId ?? focusNodeId;
      if (initialHighlight && graph.hasNode(initialHighlight)) {
        const onAfterRender = () => {
          sigma.off("afterRender", onAfterRender);
          focusRef.current = initialHighlight;
          const neighbors = getNeighborIds(graph, initialHighlight);
          neighborsRef.current = neighbors;
          sigma.refresh();
          if (!previewNodeId && focusNodeId) {
            animateCameraToHighlightedNodes(sigma as never, initialHighlight, neighbors);
          }
        };
        sigma.on("afterRender", onAfterRender);
      }
    })();

    return () => {
      cancelled = true;
      const sigma = sigmaRef.current;
      if (sigma) {
        sigma.kill();
        sigmaRef.current = null;
      }
      graphRef.current = null;
      graphThemeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebuild layout when data changes
  }, [data, edgeReducer, nodeReducer]);

  return <div ref={containerRef} style={buildGraphContainerStyle()} />;
}

export const ProfessorGraphView = memo(ProfessorGraphViewInner);
