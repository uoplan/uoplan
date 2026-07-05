import { LOCAL_STORAGE_KEY } from "../store/constants";
import { useGraphPlannerStore } from "../store/graphPlannerStore";
import { getRegisteredAppStore } from "../store/storeRegistry";

/** Write encoded app state to localStorage immediately (no debounce). */
export function flushPersistedAppState(): void {
  if (typeof window === "undefined") return;
  const store = getRegisteredAppStore();
  if (!store) return;
  // While a graph-planner term is open in the calendar, the store holds that
  // term's hypothetical completed-course context (real transcript + earlier
  // planned terms). Skip persistence so this sandbox never overwrites the
  // student's real saved state; it's restored in-memory on return to the planner.
  const linkedTermId = useGraphPlannerStore.getState().linkedCalendarTermId;
  if (linkedTermId !== null && linkedTermId === store.getState().selectedTermId) return;
  const base64 = store.getState().getEncodedStateBase64();
  if (base64) {
    localStorage.setItem(LOCAL_STORAGE_KEY, base64);
    store.setState({ hasPendingSave: false, lastSavedAt: Date.now() });
  }
}
