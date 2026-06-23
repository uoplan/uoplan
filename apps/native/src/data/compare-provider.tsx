import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  addToCompare,
  clearCompare,
  compareRefsEqual,
  isInCompare,
  removeFromCompare,
  toggleCompare,
  type CompareRef,
} from "@uoplan/core";

import { getAnalytics } from "@/lib/analytics/client";

interface CompareContextValue {
  /** Transient compare refs for this app session only. */
  refs: CompareRef[];
  count: number;
  has(ref: CompareRef): boolean;
  add(ref: CompareRef): void;
  remove(ref: CompareRef): void;
  toggle(ref: CompareRef): void;
  clear(): void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

function captureMutation(
  event: "compare_added" | "compare_removed",
  ref: CompareRef,
  count: number,
) {
  getAnalytics().capture(event, { kind: ref.kind, id: ref.id, count });
}

function sameRefs(a: readonly CompareRef[], b: readonly CompareRef[]): boolean {
  return a.length === b.length && a.every((ref, index) => compareRefsEqual(ref, b[index]!));
}

/**
 * Holds the session-only comparison tray. Unlike the basket, compare selection is
 * never persisted; shareability comes from the compare route's `ids` param.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [refs, setRefs] = useState<CompareRef[]>([]);

  const value = useMemo<CompareContextValue>(
    () => ({
      refs,
      count: refs.length,
      has: (ref) => isInCompare(refs, ref),
      add: (ref) =>
        setRefs((current) => {
          const next = addToCompare(current, ref);
          if (!sameRefs(current, next)) captureMutation("compare_added", ref, next.length);
          return next;
        }),
      remove: (ref) =>
        setRefs((current) => {
          const next = removeFromCompare(current, ref);
          if (!sameRefs(current, next)) captureMutation("compare_removed", ref, next.length);
          return next;
        }),
      toggle: (ref) =>
        setRefs((current) => {
          const removing = isInCompare(current, ref);
          const next = toggleCompare(current, ref);
          if (!sameRefs(current, next)) {
            captureMutation(removing ? "compare_removed" : "compare_added", ref, next.length);
          }
          return next;
        }),
      clear: () => setRefs(clearCompare()),
    }),
    [refs],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

/** Access the compare tray. Throws if used outside {@link CompareProvider}. */
export function useCompare(): CompareContextValue {
  const value = useContext(CompareContext);
  if (!value) throw new Error("useCompare must be used within a CompareProvider");
  return value;
}
