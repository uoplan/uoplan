import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getAnalytics } from "@/lib/analytics/client";

import { readBasket, toggleCode, writeBasket } from "./basket-storage";

interface BasketContextValue {
  /** Course codes currently in the basket (insertion order). */
  codes: string[];
  count: number;
  has(code: string): boolean;
  add(code: string): void;
  remove(code: string): void;
  toggle(code: string): void;
  clear(): void;
}

const BasketContext = createContext<BasketContextValue | null>(null);

/**
 * Holds the user's basket of desired course codes (the native analogue of the
 * web sitewide basket / generation requirements cart). State is persisted to a
 * JSON file in the app's document dir and reloaded on launch, so a basket
 * survives restarts. Mutations are debounced to the same render via React state.
 */
export function BasketProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<string[]>([]);
  // Skip persisting the very first state set (the initial load from disk).
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    void readBasket().then((loaded) => {
      if (active && loaded.length > 0) setCodes(loaded);
      hydrated.current = true;
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void writeBasket(codes);
  }, [codes]);

  const value = useMemo<BasketContextValue>(
    () => ({
      codes,
      count: codes.length,
      has: (code) => codes.includes(code),
      add: (code) =>
        setCodes((current) => {
          if (current.includes(code)) return current;
          getAnalytics().capture("basket_course_added", { courseCode: code });
          return [...current, code];
        }),
      remove: (code) =>
        setCodes((current) => {
          if (!current.includes(code)) return current;
          getAnalytics().capture("basket_course_removed", { courseCode: code });
          return current.filter((c) => c !== code);
        }),
      toggle: (code) =>
        setCodes((current) => {
          getAnalytics().capture(
            current.includes(code) ? "basket_course_removed" : "basket_course_added",
            {
              courseCode: code,
            },
          );
          return toggleCode(current, code);
        }),
      clear: () => setCodes([]),
    }),
    [codes],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

/** Access the basket. Throws if used outside {@link BasketProvider}. */
export function useBasket(): BasketContextValue {
  const value = useContext(BasketContext);
  if (!value) throw new Error("useBasket must be used within a BasketProvider");
  return value;
}
