import { useEffect, useRef, useState } from "react";
import type { CourseGradesData, ProfessorCoTeachingGraph } from "@uoplan/schedule";
import { buildProfessorCoTeachingGraph } from "@uoplan/schedule";
import type { ExploreOfferingFlat } from "../lib/explore/gradesSearch";
import { buildOfferingsByProfessorId } from "../lib/graph/professorGraphDetails";
import type {
  ProfessorGraphBuildMessage,
  ProfessorGraphBuildRequest,
} from "../workers/professorGraphBuild.worker";

function recordToMap(
  record: Record<string, ExploreOfferingFlat[]>,
): Map<string, ExploreOfferingFlat[]> {
  return new Map(Object.entries(record));
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function buildOnMainThread(
  grades: CourseGradesData,
  onProgress: (ratio: number) => void,
  cancelled: () => boolean,
): Promise<{
  graph: ProfessorCoTeachingGraph;
  offeringsByProfessorId: Map<string, ExploreOfferingFlat[]>;
}> {
  let graphRatio = 0;
  const graph = buildProfessorCoTeachingGraph(grades, (ratio) => {
    graphRatio = ratio;
    onProgress(ratio * 0.55);
  });
  if (cancelled()) throw new Error("cancelled");

  await yieldToMain();
  if (cancelled()) throw new Error("cancelled");

  const offerings = buildOfferingsByProfessorId(grades, (ratio) => {
    onProgress(0.55 + ratio * 0.45);
  });
  if (cancelled()) throw new Error("cancelled");

  if (graphRatio < 1) onProgress(1);
  return { graph, offeringsByProfessorId: offerings };
}

export function useProfessorGraphBuild(grades: CourseGradesData | null | undefined) {
  const [graphData, setGraphData] = useState<ProfessorCoTeachingGraph | null>(null);
  const [offeringsByProfessorId, setOfferingsByProfessorId] = useState<
    Map<string, ExploreOfferingFlat[]>
  >(new Map());
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [prevGrades, setPrevGrades] = useState(grades);
  const workerRef = useRef<Worker | null>(null);

  if (prevGrades !== grades) {
    setPrevGrades(grades);
    setGraphData(null);
    setOfferingsByProfessorId(new Map());
    setBuildProgress(0);
    setBuildError(null);
  }

  useEffect(() => {
    if (!grades) return;

    let cancelled = false;

    const handleProgress = (ratio: number) => {
      if (!cancelled) setBuildProgress(Math.min(100, Math.round(ratio * 100)));
    };

    const handleDone = (
      graph: ProfessorCoTeachingGraph,
      offerings: Map<string, ExploreOfferingFlat[]>,
    ) => {
      if (cancelled) return;
      setGraphData(graph);
      setOfferingsByProfessorId(offerings);
      setBuildProgress(100);
    };

    const runMainThreadFallback = () => {
      void buildOnMainThread(grades, handleProgress, () => cancelled)
        .then(({ graph, offeringsByProfessorId: offerings }) => {
          handleDone(graph, offerings);
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof Error && err.message === "cancelled")) return;
          setBuildError(err instanceof Error ? err.message : "Failed to build professor graph");
        });
    };

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/professorGraphBuild.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      runMainThreadFallback();
      return () => {
        cancelled = true;
      };
    }

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ProfessorGraphBuildMessage>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        handleProgress(msg.ratio);
        return;
      }
      if (msg.type === "done") {
        handleDone(msg.graph, recordToMap(msg.offeringsByProfessorId));
        return;
      }
      if (msg.type === "error" && !cancelled) {
        setBuildError(msg.message);
      }
    };

    worker.onerror = () => {
      worker?.terminate();
      workerRef.current = null;
      if (!cancelled) runMainThreadFallback();
    };

    const request: ProfessorGraphBuildRequest = { type: "build", grades };
    worker.postMessage(request);

    return () => {
      cancelled = true;
      worker?.terminate();
      workerRef.current = null;
    };
  }, [grades]);

  const effectiveGraphData = grades ? graphData : null;
  const effectiveBuildError = grades ? buildError : null;
  const isBuilding = !!grades && !effectiveGraphData && !effectiveBuildError;

  return {
    graphData: effectiveGraphData,
    offeringsByProfessorId: grades
      ? offeringsByProfessorId
      : new Map<string, ExploreOfferingFlat[]>(),
    buildProgress: grades ? buildProgress : 0,
    buildError: effectiveBuildError,
    isBuilding,
  };
}
