import type { CanonicalProfessorName, ProfessorNameKey } from "@uoplan/domain/brand";
import type { CourseGradesData } from "@uoplan/domain/dataTypes";
import { pickCanonicalProfessorName } from "./professorIdentity";
import { normalizeProfessorName } from "./professorRatings";
import { parseCourseCode } from "@uoplan/domain/utils/courseUtils";

export type ProfessorGraphNode = {
  id: string;
  displayName: CanonicalProfessorName;
  legacyId?: number;
  degree: number;
  /** Subject prefixes with section-offering counts (one per professor row in grades data). */
  disciplineWeights: Record<string, number>;
  subjects: string[];
};

export type ProfessorGraphEdge = {
  source: string;
  target: string;
  weight: number;
};

export type ProfessorCoTeachingGraph = {
  nodes: ProfessorGraphNode[];
  edges: ProfessorGraphEdge[];
};

export function professorGraphId(legacyId?: number, name?: string): string {
  if (legacyId != null) return `id:${legacyId}`;
  const key: ProfessorNameKey = normalizeProfessorName(name ?? "");
  return `name:${key.toLowerCase()}`;
}

function subjectFromCourseCode(code: string): string {
  const parsed = parseCourseCode(code);
  if (parsed) return parsed.discipline;
  const [subject = ""] = code.trim().replaceAll(/\s+/g, " ").split(" ");
  return subject.toUpperCase();
}

function canonicalPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Build professor co-teaching graph from historical grade offerings.
 * Edge exists when two professors appear under the same course code; weight sums
 * min(offeringCountA, offeringCountB) per shared course.
 */
const GRAPH_BUILD_PROGRESS_EVERY = 48;

export function buildProfessorCoTeachingGraph(
  grades: CourseGradesData,
  onProgress?: (ratio: number) => void,
): ProfessorCoTeachingGraph {
  const courses = grades.courses;
  const courseCount = courses.length;
  const nodeMeta = new Map<
    string,
    {
      displayName: CanonicalProfessorName;
      legacyId?: number;
      disciplineWeights: Map<string, number>;
    }
  >();
  const edgeWeights = new Map<string, number>();

  for (let courseIndex = 0; courseIndex < courseCount; courseIndex++) {
    const course = courses[courseIndex];
    const counts = new Map<string, number>();

    for (const p of course.sections) {
      if (!p.name?.trim()) continue;
      const id = professorGraphId(p.legacyId, p.name);
      counts.set(id, (counts.get(id) ?? 0) + 1);

      let meta = nodeMeta.get(id);
      if (!meta) {
        meta = {
          displayName: pickCanonicalProfessorName([p.name]),
          legacyId: p.legacyId,
          disciplineWeights: new Map(),
        };
        nodeMeta.set(id, meta);
      }
      const subject = subjectFromCourseCode(course.code);
      if (subject) {
        meta.disciplineWeights.set(subject, (meta.disciplineWeights.get(subject) ?? 0) + 1);
      }
    }

    const ids = [...counts.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        const pairKey = canonicalPairKey(a, b);
        const contribution = Math.min(counts.get(a)!, counts.get(b)!);
        edgeWeights.set(pairKey, (edgeWeights.get(pairKey) ?? 0) + contribution);
      }
    }

    if (
      onProgress &&
      (courseIndex % GRAPH_BUILD_PROGRESS_EVERY === 0 || courseIndex === courseCount - 1)
    ) {
      onProgress((courseIndex + 1) / courseCount);
    }
  }

  onProgress?.(1);

  const degree = new Map<string, number>();
  const edges: ProfessorGraphEdge[] = [];

  for (const [pairKey, weight] of edgeWeights) {
    const sep = pairKey.indexOf("|");
    const source = pairKey.slice(0, sep);
    const target = pairKey.slice(sep + 1);
    edges.push({ source, target, weight });
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  }

  const nodes: ProfessorGraphNode[] = [...nodeMeta.entries()].map(([id, meta]) => {
    const disciplineWeights = Object.fromEntries(meta.disciplineWeights);
    return {
      id,
      displayName: meta.displayName,
      legacyId: meta.legacyId,
      degree: degree.get(id) ?? 0,
      disciplineWeights,
      subjects: Object.keys(disciplineWeights).sort((a, b) => a.localeCompare(b, "en")),
    };
  });

  nodes.sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));

  return { nodes, edges };
}
