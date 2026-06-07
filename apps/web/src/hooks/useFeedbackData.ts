import { useEffect, useState } from "react";
import { buildFeedbackIndex, FeedbackProto, type FeedbackIndex } from "@uoplan/core";
import { dataPaths } from "@uoplan/data";
import { useAppStore } from "../store/appStore";

interface FeedbackState {
  loading: boolean;
  data: FeedbackIndex | null;
  error: string | null;
}

// Shared across every consumer so the ~900 KB asset is fetched and decoded once.
let cachedIndex: FeedbackIndex | null = null;
let inFlight: Promise<FeedbackIndex> | null = null;

async function loadFeedbackIndex(indicesCourses: readonly string[]): Promise<FeedbackIndex> {
  if (cachedIndex) return cachedIndex;
  if (!inFlight) {
    inFlight = (async () => {
      const res = await fetch(dataPaths.feedback);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const decoded = FeedbackProto.FeedbackData.decode(bytes);
      cachedIndex = buildFeedbackIndex(decoded, indicesCourses);
      return cachedIndex;
    })().catch((err) => {
      inFlight = null; // allow a later retry
      throw err;
    });
  }
  return inFlight;
}

/**
 * Lazily fetch + decode the combined course-evaluation dataset (`feedback.pb`).
 * Only triggers the network request on first use (feedback routes / trends), and
 * the decoded index is memoized process-wide. Needs the shared `indices.pb` course
 * list (already in the store) to resolve course codes.
 */
export function useFeedbackData(): FeedbackState {
  const indicesCourses = useAppStore((s) => s.indices?.courses ?? null);
  const [state, setState] = useState<FeedbackState>(() => ({
    loading: cachedIndex == null,
    data: cachedIndex,
    error: null,
  }));

  useEffect(() => {
    if (!indicesCourses || cachedIndex) {
      if (cachedIndex) setState({ loading: false, data: cachedIndex, error: null });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loadFeedbackIndex(indicesCourses)
      .then((index) => {
        if (active) setState({ loading: false, data: index, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({
            loading: false,
            data: null,
            error: err instanceof Error ? err.message : "Failed to load feedback",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [indicesCourses]);

  return state;
}
