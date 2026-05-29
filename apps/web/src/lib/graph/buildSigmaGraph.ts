import Graph from "graphology";
import {
  blendProfessorDisciplineColor,
  type ProfessorCoTeachingGraph,
  type ProfessorGraphNode,
} from "@uoplan/core";

export type ProfessorNodeAttributes = {
  label: string | null;
  x: number;
  y: number;
  size: number;
  color: string;
  legacyId?: number;
  degree: number;
  subjects: string[];
  forceLabel?: boolean;
  zIndex?: number;
};

export type ProfessorEdgeAttributes = {
  weight: number;
  size: number;
  color: string;
};

export const GRAPH_EDGE_COLOR = "rgba(36, 39, 44, 0.018)";
const NODE_ALPHA = 0.72;
const MIN_NODE_SIZE = 2.5;
const MAX_NODE_SIZE = 5.5;

function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgba = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${alpha})`;
  return color;
}
const MIN_EDGE_SIZE = 0.25;
const MAX_EDGE_SIZE = 1.1;

function nodeSizeForDegree(degree: number, maxDegree: number): number {
  if (degree <= 0) return MIN_NODE_SIZE;
  if (maxDegree <= 0) return MIN_NODE_SIZE;
  const t = Math.sqrt(degree / maxDegree);
  return MIN_NODE_SIZE + (MAX_NODE_SIZE - MIN_NODE_SIZE) * t;
}

function edgeSizeForWeight(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return MIN_EDGE_SIZE;
  return MIN_EDGE_SIZE + ((MAX_EDGE_SIZE - MIN_EDGE_SIZE) * weight) / maxWeight;
}

export function randomInitialPosition(seed: string): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const r = 1 + ((h >> 16) & 0xff) / 255;
  return { x: Math.cos(a) * r * 100, y: Math.sin(a) * r * 100 };
}

export function buildSigmaGraph(data: ProfessorCoTeachingGraph): {
  graph: Graph<ProfessorNodeAttributes, ProfessorEdgeAttributes>;
  nodesById: Map<string, ProfessorGraphNode>;
  maxDegree: number;
} {
  const maxDegree = Math.max(1, ...data.nodes.map((n) => n.degree));
  const maxWeight = Math.max(1, ...data.edges.map((e) => e.weight));
  const nodesById = new Map(data.nodes.map((n) => [n.id, n]));

  const graph = new Graph<ProfessorNodeAttributes, ProfessorEdgeAttributes>({
    multi: false,
  });

  for (const node of data.nodes) {
    const pos = randomInitialPosition(node.id);
    graph.addNode(node.id, {
      label: null,
      x: pos.x,
      y: pos.y,
      size: nodeSizeForDegree(node.degree, maxDegree),
      color: colorWithAlpha(blendProfessorDisciplineColor(node.disciplineWeights), NODE_ALPHA),
      legacyId: node.legacyId,
      degree: node.degree,
      subjects: node.subjects,
    });
  }

  for (const edge of data.edges) {
    const key =
      edge.source < edge.target
        ? `${edge.source}--${edge.target}`
        : `${edge.target}--${edge.source}`;
    if (graph.hasEdge(key)) continue;
    graph.addEdgeWithKey(key, edge.source, edge.target, {
      weight: edge.weight,
      size: edgeSizeForWeight(edge.weight, maxWeight),
      color: GRAPH_EDGE_COLOR,
    });
  }

  return { graph, nodesById, maxDegree };
}

export function getNeighborIds(graph: Graph, nodeId: string): Set<string> {
  const out = new Set<string>();
  if (!graph.hasNode(nodeId)) return out;
  graph.forEachNeighbor(nodeId, (neighbor) => {
    out.add(neighbor);
  });
  return out;
}
