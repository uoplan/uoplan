import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Core decoded dataset (catalogue manifest + cache + indices) plus boot status.
 * These are the essentials every data-gated route reads. Grouped behind
 * {@link useShallow} so consumers re-render only when one of these changes.
 */
export function useDataset() {
  return useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      indices: s.indices,
      schedulesData: s.schedulesData,
      cache: s.cache,
      loading: s.loading,
      loadProgress: s.loadProgress,
      error: s.error,
    })),
  );
}

/** The decoded {@link DataCache}, or null before boot. The single most-read field. */
export function useDataCache() {
  return useAppStore((s) => s.cache);
}

/** The catalogue manifest, or null before boot. */
export function useCatalogue() {
  return useAppStore((s) => s.catalogue);
}

/** The decoded course/program indices, or null before boot. */
export function useIndices() {
  return useAppStore((s) => s.indices);
}

/** Trigger core data boot (idempotent). */
export function useLoadData() {
  return useAppStore((s) => s.loadData);
}
