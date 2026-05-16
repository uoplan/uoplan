import type Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

const DEFAULT_TOTAL_ITERATIONS = 120;
const ITERATIONS_PER_CHUNK = 8;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function runForceAtlas2Chunked(
  graph: Graph,
  options?: {
    totalIterations?: number;
    iterationsPerChunk?: number;
    onProgress?: (ratio: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<void> {
  const totalIterations = options?.totalIterations ?? DEFAULT_TOTAL_ITERATIONS;
  const iterationsPerChunk = options?.iterationsPerChunk ?? ITERATIONS_PER_CHUNK;
  const settings = forceAtlas2.inferSettings(graph);

  let done = 0;
  options?.onProgress?.(0);

  while (done < totalIterations) {
    if (options?.isCancelled?.()) return;

    const chunk = Math.min(iterationsPerChunk, totalIterations - done);
    forceAtlas2.assign(graph, { iterations: chunk, settings });
    done += chunk;
    options?.onProgress?.(done / totalIterations);

    if (done < totalIterations) {
      await yieldToMain();
    }
  }

  options?.onProgress?.(1);
}
