import { useSyncExternalStore } from "react";

/** A visited location, kept granular enough to label and restore (path + query). */
export type TrackedLocation = {
  pathname: string;
  /** Raw search string including the leading "?", or "" when there is none. */
  search: string;
};

/**
 * Global tracker of the location a browser "back" would return to (the history
 * entry one slot below the current one), so the shared {@link BackButton} can
 * label its target to match wherever the pop actually lands, on every route,
 * without each forward navigation having to attach an explicit `state.back`.
 *
 * TanStack Router stamps every location with `state.__TSR_index` (its slot in
 * the history stack) and `router.history.back()` always lands on `index - 1`,
 * so a map of index -> location makes "previous" exact. REPLACE navigations
 * reuse the current index (they add no entry), so same-section churn like the
 * personalize `?step=` deep-link toggles never shifts the recorded previous
 * page. `__root` feeds this from the router history subscription.
 */
const indexToLocation = new Map<number, TrackedLocation>();
let previousLocation: TrackedLocation | null = null;
const listeners = new Set<() => void>();

/** Record the location now at `index`; recomputes the previous-entry location. */
export function recordLocation(index: number, pathname: string, search: string): void {
  indexToLocation.set(index, { pathname, search });
  const next = index > 0 ? (indexToLocation.get(index - 1) ?? null) : null;
  if (next?.pathname === previousLocation?.pathname && next?.search === previousLocation?.search) {
    return;
  }
  previousLocation = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPreviousLocation(): TrackedLocation | null {
  return previousLocation;
}

/** The location a browser "back" would return to, or null when there is none. */
export function usePreviousLocation(): TrackedLocation | null {
  return useSyncExternalStore(subscribe, getPreviousLocation, () => null);
}

/** Test-only: clear the recorded history so cases don't bleed across tests. */
export function __resetNavigationHistory(): void {
  indexToLocation.clear();
  previousLocation = null;
}
