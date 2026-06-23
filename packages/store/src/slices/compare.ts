import type { StateCreator } from "zustand";
import { addToCompare, clearCompare, removeFromCompare, toggleCompare } from "@uoplan/core";
import type { AppStore } from "../types";

interface CompareSlice {
  addToCompare: AppStore["addToCompare"];
  removeFromCompare: AppStore["removeFromCompare"];
  toggleCompare: AppStore["toggleCompare"];
  clearCompare: AppStore["clearCompare"];
}

/**
 * Transient compare-tray slice. State (`compareRefs`) is intentionally absent
 * from the share-state encoding (`slices/url.ts`) so it is never persisted —
 * the comparison set is carried in the compare route URL instead. All mutations
 * delegate to the shared `@uoplan/core` pure reducers so web + native behave
 * identically (homogeneous kind, capped at `MAX_COMPARE_ITEMS`).
 */
export const createCompareSlice: StateCreator<AppStore, [], [], CompareSlice> = (set, get) => ({
  addToCompare: (ref) => set({ compareRefs: addToCompare(get().compareRefs, ref) }),
  removeFromCompare: (ref) => set({ compareRefs: removeFromCompare(get().compareRefs, ref) }),
  toggleCompare: (ref) => set({ compareRefs: toggleCompare(get().compareRefs, ref) }),
  clearCompare: () => set({ compareRefs: clearCompare() }),
});
