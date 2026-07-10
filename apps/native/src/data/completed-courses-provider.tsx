import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppStoreApi } from "@uoplan/store/appStore";

import { readCompletedCourses, writeCompletedCourses } from "./completed-courses-storage";

interface CompletedCoursesContextValue {
  /** Course codes the student has already completed (insertion order). */
  codes: string[];
  count: number;
  has(code: string): boolean;
  add(code: string): void;
  remove(code: string): void;
  /** Replace the whole list (used by the personalize completed-courses editor). */
  set(codes: string[]): void;
  clear(): void;
}

const CompletedCoursesContext = createContext<CompletedCoursesContextValue | null>(null);

/**
 * Holds the student's *completed* courses — the courses they have already taken,
 * used to satisfy prerequisites and degree requirements. This is intentionally
 * SEPARATE from the basket (the cart of courses to generate a schedule for): the
 * basket is what you want to take, while completed courses are what you've
 * already done. Transcript import and the personalize "completed courses" editor
 * populate this; adding a course to the cart does NOT. Persisted to a JSON file
 * in the document dir and reloaded on launch so the list survives restarts.
 */
export function CompletedCoursesProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<string[]>([]);
  // Skip persisting the very first state set (the initial load from disk).
  const hydrated = useRef(false);
  // Mirror into the shared planner store so store-driven screens see the same list.
  const storeApi = useAppStoreApi();

  useEffect(() => {
    let active = true;
    void readCompletedCourses().then((loaded) => {
      if (active && loaded.length > 0) setCodes(loaded);
      hydrated.current = true;
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void writeCompletedCourses(codes);
    // Dual-write: keep @uoplan/store in sync during the Context → store migration.
    storeApi.getState().setCompletedCourses(codes);
  }, [codes, storeApi]);

  const value = useMemo<CompletedCoursesContextValue>(
    () => ({
      codes,
      count: codes.length,
      has: (code) => codes.includes(code),
      add: (code) => setCodes((current) => (current.includes(code) ? current : [...current, code])),
      remove: (code) => setCodes((current) => current.filter((c) => c !== code)),
      set: (next) => {
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const code of next) {
          if (!seen.has(code)) {
            seen.add(code);
            deduped.push(code);
          }
        }
        setCodes(deduped);
      },
      clear: () => setCodes([]),
    }),
    [codes],
  );

  return (
    <CompletedCoursesContext.Provider value={value}>{children}</CompletedCoursesContext.Provider>
  );
}

/** Access the completed-courses list. Throws if used outside the provider. */
export function useCompletedCourses(): CompletedCoursesContextValue {
  const value = useContext(CompletedCoursesContext);
  if (!value) {
    throw new Error("useCompletedCourses must be used within a CompletedCoursesProvider");
  }
  return value;
}
