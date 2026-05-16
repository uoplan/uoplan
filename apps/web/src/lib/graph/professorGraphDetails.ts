import type {
  CourseGradesData,
  GradeVizData,
  ProfessorCoTeachingGraph,
  ProfessorGraphNode,
} from "schedule";
import {
  normalizeCourseCode,
  normalizeGradeVizDistribution,
  normalizeProfessorName,
  professorGraphId,
} from "schedule";
import { mergeGradeDistributionCounts, type ExploreOfferingFlat } from "../explore/gradesSearch";
import { formatUottawaTermIdLabel } from "../explore/uottawaTermId";

export type NeighborSortMode = "strength" | "name";

export type GraphNeighbor = {
  node: ProfessorGraphNode;
  weight: number;
};

const OFFERINGS_BUILD_PROGRESS_EVERY = 64;

function offeringRowId(parts: {
  courseCode: string;
  legacyId?: number;
  name: string;
  termId: number;
  section?: string;
}): string {
  return [
    parts.courseCode,
    parts.legacyId ?? "",
    normalizeProfessorName(parts.name).toLowerCase(),
    String(parts.termId),
    parts.section ?? "",
  ].join("|");
}

export function buildOfferingsByProfessorId(
  grades: CourseGradesData,
  onProgress?: (ratio: number) => void,
): Map<string, ExploreOfferingFlat[]> {
  const byId = new Map<string, ExploreOfferingFlat[]>();
  const courses = grades.courses;
  const courseCount = courses.length;

  for (let courseIndex = 0; courseIndex < courseCount; courseIndex++) {
    const c = courses[courseIndex];
    const norm = normalizeCourseCode(c.code);

    for (const p of c.professors) {
      const termLabel = formatUottawaTermIdLabel(p.termId);
      const fuseText = [
        c.code,
        norm,
        p.name,
        p.legacyId != null ? String(p.legacyId) : "",
        termLabel,
        p.section ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const offering: ExploreOfferingFlat = {
        id: offeringRowId({
          courseCode: c.code,
          legacyId: p.legacyId,
          name: p.name,
          termId: p.termId,
          section: p.section,
        }),
        courseCode: c.code,
        courseTitle: "",
        professorName: p.name,
        legacyId: p.legacyId,
        termId: p.termId,
        termLabel,
        section: p.section,
        fuseText,
        distribution: p.distribution,
      };

      const id = professorGraphId(p.legacyId, p.name);
      const list = byId.get(id);
      if (list) {
        list.push(offering);
      } else {
        byId.set(id, [offering]);
      }
    }

    if (
      onProgress &&
      (courseIndex % OFFERINGS_BUILD_PROGRESS_EVERY === 0 || courseIndex === courseCount - 1)
    ) {
      onProgress((courseIndex + 1) / courseCount);
    }
  }

  onProgress?.(1);
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
