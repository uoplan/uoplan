import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { isInCompare, MAX_COMPARE_ITEMS } from "@uoplan/core";
import type { CompareKind, CompareRef } from "@uoplan/core";
import { useAppStore } from "../store/appStore";

/** The transient compare-tray selection. */
export function useCompareRefs(): CompareRef[] {
  return useAppStore((s) => s.compareRefs);
}

/** Number of refs currently in the compare tray. */
export function useCompareCount(): number {
  return useAppStore((s) => s.compareRefs.length);
}

/** The compare tray plus its full set of mutators. */
export function useCompareSelection() {
  const compareRefs = useCompareRefs();
  const { addToCompare, removeFromCompare, toggleCompare, clearCompare } = useAppStore(
    useShallow((s) => ({
      addToCompare: s.addToCompare,
      removeFromCompare: s.removeFromCompare,
      toggleCompare: s.toggleCompare,
      clearCompare: s.clearCompare,
    })),
  );
  return { compareRefs, addToCompare, removeFromCompare, toggleCompare, clearCompare };
}

/**
 * Membership + mutation helpers for a single ref, for "add to compare"
 * affordances. `atLimit` is true when the tray is full and this ref is not in
 * it (so adding would be a no-op).
 */
export function useCompareMembership(ref: CompareRef) {
  const { kind, id } = ref;
  const inCompare = useAppStore((s) => isInCompare(s.compareRefs, ref));
  const trayLength = useAppStore((s) => s.compareRefs.length);
  const trayKind = useAppStore((s) => s.compareRefs[0]?.kind);
  const toggleCompare = useAppStore((s) => s.toggleCompare);
  const addToCompare = useAppStore((s) => s.addToCompare);
  const removeFromCompare = useAppStore((s) => s.removeFromCompare);
  const atLimit = !inCompare && trayKind === kind && trayLength >= MAX_COMPARE_ITEMS;
  return useMemo(() => {
    const target: CompareRef = { kind, id };
    return {
      inCompare,
      atLimit,
      toggle: () => toggleCompare(target),
      add: () => addToCompare(target),
      remove: () => removeFromCompare(target),
    };
  }, [inCompare, atLimit, toggleCompare, addToCompare, removeFromCompare, kind, id]);
}

/** Convenience: a course-code compare ref. */
export function courseCompareRef(code: string): CompareRef {
  return { kind: "course" as CompareKind, id: code };
}
