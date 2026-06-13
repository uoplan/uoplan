import { useAppStore } from "../appStore";

/** App-wide reset / cache actions that span every slice. */
export function useGlobalActions() {
  const resetToDefault = useAppStore((s) => s.resetToDefault);
  const clearEnrollmentsCache = useAppStore((s) => s.clearEnrollmentsCache);
  return { resetToDefault, clearEnrollmentsCache };
}
