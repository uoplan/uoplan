import { useEffect, useState } from "react";
import { DataProto, DescriptionSearchIndex } from "@uoplan/core";
import { dataAssetIds } from "@uoplan/data";
import { loadProto } from "../lib/protoFetch";

interface DescriptionSearchState {
  loading: boolean;
  index: DescriptionSearchIndex | null;
  error: string | null;
}

// Shared across every consumer so the ~200 KB asset is fetched and decoded once.
let cachedIndex: DescriptionSearchIndex | null = null;
let inFlight: Promise<DescriptionSearchIndex> | null = null;

async function loadDescriptionSearchIndex(): Promise<DescriptionSearchIndex> {
  if (cachedIndex) return cachedIndex;
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const decoded = await loadProto(DataProto.CourseSearchIndex, dataAssetIds.catalogueSearch);
        cachedIndex = DescriptionSearchIndex.fromProto(decoded);
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
 * Lazily fetch + decode the compact course-description keyword index
 * (`catalogue.search.pb`, ~200 KB gz). Only triggers the network request when
 * explore search is first used, and the decoded index is memoized process-wide.
 */
export function useDescriptionSearchIndex(enabled = true): DescriptionSearchState {
  const [state, setState] = useState<DescriptionSearchState>(() => ({
    loading: enabled && cachedIndex == null,
    index: cachedIndex,
    error: null,
  }));

  useEffect(() => {
    if (!enabled || cachedIndex) {
      if (cachedIndex) setState({ loading: false, index: cachedIndex, error: null });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void (async () => {
      try {
        const index = await loadDescriptionSearchIndex();
        if (active) setState({ loading: false, index, error: null });
      } catch (err: unknown) {
        if (active) {
          setState({
            loading: false,
            index: null,
            error: err instanceof Error ? err.message : "Failed to load description search index",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
