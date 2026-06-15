import { useAppStoreApi } from "../appStore";

/**
 * Sanctioned access to the raw store instance for the rare imperative cases that
 * genuinely need `getState()` / `subscribe()` (e.g. one-off reads in effects or
 * change subscriptions). Prefer the reactive projection hooks for everything else.
 */
export function useStoreApi() {
  return useAppStoreApi();
}
