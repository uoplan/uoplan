import type {
  CourseGradesData,
  GradeVizData,
  ProfessorCoTeachingGraph,
  ProfessorGraphNode,
} from "schedule";
import { normalizeGradeVizDistribution, professorGraphId } from "schedule";
import {
  buildExploreOfferings,
  mergeGradeDistributionCounts,
  type ExploreOfferingFlat,
} from "../explore/gradesSearch";

export type NeighborSortMode = "strength" | "name";

export type GraphNeighbor = {
  node: ProfessorGraphNode;
  weight: number;
};

export function buildOfferingsByProfessorId(
  grades: CourseGradesData,
): Map<string, ExploreOfferingFlat[]> {
  const offerings = buildExploreOfferings(grades, new Map(), new Map());
  const byId = new Map<string, ExploreOfferingFlat[]>();

  for (const o of offerings) {
    const id = professorGraphId(o.legacyId, o.professorName);
    const list = byId.get(id);
    if (list) {
      list.push(o);
    } else {
      byId.set(id, [o]);
    }
  }

  return byId;
}

export function getAggregateGradeViz(offerings: ExploreOfferingFlat[]): GradeVizData | null {
  if (offerings.length === 0) return null;
  return normalizeGradeVizDistribution(
    mergeGradeDistributionCounts(offerings.map((o) => o.distribution)),
  );
}

export function getGraphNeighbors(
  graph: ProfessorCoTeachingGraph,
  nodeId: string,
  nodesById: Map<string, ProfessorGraphNode>,
): GraphNeighbor[] {
  const neighbors: GraphNeighbor[] = [];

  for (const edge of graph.edges) {
    if (edge.source === nodeId) {
      const node = nodesById.get(edge.target);
      if (node) neighbors.push({ node, weight: edge.weight });
    } else if (edge.target === nodeId) {
      const node = nodesById.get(edge.source);
      if (node) neighbors.push({ node, weight: edge.weight });
    }
  }

  return neighbors;
}

export function sortGraphNeighbors(
  neighbors: GraphNeighbor[],
  mode: NeighborSortMode,
): GraphNeighbor[] {
  const sorted = [...neighbors];
  if (mode === "strength") {
    sorted.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.node.displayName.localeCompare(b.node.displayName, "en");
    });
  } else {
    sorted.sort((a, b) => a.node.displayName.localeCompare(b.node.displayName, "en"));
  }
  return sorted;
}
