import {
  buildProfessorCoTeachingGraph,
  type CourseGradesData,
  type ProfessorCoTeachingGraph,
} from "@uoplan/core";
import { buildOfferingsByProfessorId } from "../lib/graph/professorGraphDetails";
import type { ExploreOfferingFlat } from "../lib/explore/gradesSearch";

export type ProfessorGraphBuildRequest = {
  type: "build";
  grades: CourseGradesData;
};

export type ProfessorGraphBuildProgress = {
  type: "progress";
  ratio: number;
  phase: "graph" | "offerings";
};

export type ProfessorGraphBuildDone = {
  type: "done";
  graph: ProfessorCoTeachingGraph;
  offeringsByProfessorId: Record<string, ExploreOfferingFlat[]>;
};

export type ProfessorGraphBuildError = {
  type: "error";
  message: string;
};

export type ProfessorGraphBuildMessage =
  | ProfessorGraphBuildProgress
  | ProfessorGraphBuildDone
  | ProfessorGraphBuildError;

function mapToRecord(
  map: Map<string, ExploreOfferingFlat[]>,
): Record<string, ExploreOfferingFlat[]> {
  const out: Record<string, ExploreOfferingFlat[]> = {};
  for (const [key, value] of map) {
    out[key] = value;
  }
  return out;
}

self.onmessage = (event: MessageEvent<ProfessorGraphBuildRequest>) => {
  if (event.data.type !== "build") return;

  try {
    const { grades } = event.data;

    const graph = buildProfessorCoTeachingGraph(grades, (ratio) => {
      const msg: ProfessorGraphBuildProgress = {
        type: "progress",
        phase: "graph",
        ratio: ratio * 0.55,
      };
      self.postMessage(msg);
    });

    const offerings = buildOfferingsByProfessorId(grades, (ratio) => {
      const msg: ProfessorGraphBuildProgress = {
        type: "progress",
        phase: "offerings",
        ratio: 0.55 + ratio * 0.45,
      };
      self.postMessage(msg);
    });

    const done: ProfessorGraphBuildDone = {
      type: "done",
      graph,
      offeringsByProfessorId: mapToRecord(offerings),
    };
    self.postMessage(done);
  } catch (err) {
    const message: ProfessorGraphBuildError = {
      type: "error",
      message: err instanceof Error ? err.message : "Failed to build professor graph",
    };
    self.postMessage(message);
  }
};
