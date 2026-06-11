import { useEffect, useState } from "react";
import { buildFeedbackIndex, FeedbackProto } from "@uoplan/core";
import type { FeedbackIndex } from "@uoplan/core";
import { dataAssetIds } from "@uoplan/data";
import { useAppStore } from "../store/appStore";
import { loadProto } from "../lib/protoFetch";

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
      try {
        const decoded = await loadProto(FeedbackProto.FeedbackData, dataAssetIds.feedback);
        cachedIndex = buildFeedbackIndex(decoded, indicesCourses);
        return cachedIndex;
      } catch (err) {
        inFlight = null; // allow a later retry
        throw err;
      }
    })();
  }
  return inFlight;
}

/**
 * Lazily fetch + decode the combined course-evaluation dataset (`feedback.pb`).
 * Only triggers the network request on first use (feedback routes / trends), and
 * the decoded index is memoized process-wide. Needs the shared `indices.pb` course
 * list (already in the store) to resolve course codes.
 */
export function useFeedbackData(enabled = true): FeedbackState {
  const indicesCourses = useAppStore((s) => s.indices?.courses ?? null);
  const [state, setState] = useState<FeedbackState>(() => ({
    loading: cachedIndex == null,
    data: cachedIndex,
    error: null,
  }));

  useEffect(() => {
    if (!enabled || !indicesCourses || cachedIndex) {
      if (cachedIndex) setState({ loading: false, data: cachedIndex, error: null });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void (async () => {
      try {
        const index = await loadFeedbackIndex(indicesCourses);
        if (active) setState({ loading: false, data: index, error: null });
      } catch (err: unknown) {
        if (active) {
          setState({
            loading: false,
            data: null,
            error: err instanceof Error ? err.message : "Failed to load feedback",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, indicesCourses]);

  return state;
}
