import { useEffect, useState } from "react";

/**
 * Returns false on the first render and flips to true once the browser is idle
 * (or on the next macrotask when `requestIdleCallback` is unavailable).
 *
 * Use it to defer expensive, corpus-wide work — the Explore spotlight ranking and
 * the faculty grade aggregation — until after first paint.
 */
export function useDeferredAfterPaint(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (ric) {
      const id = ric(() => setReady(true));
      return () => {
        (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(
          id,
        );
      };
    }
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return ready;
}
