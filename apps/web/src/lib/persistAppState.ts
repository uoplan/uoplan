import { LOCAL_STORAGE_KEY } from "../store/constants";
import { getRegisteredAppStore } from "../store/storeRegistry";

/** Write encoded app state to localStorage immediately (no debounce). */
export function flushPersistedAppState(): void {
  if (typeof window === "undefined") return;
  const store = getRegisteredAppStore();
  if (!store) return;
  const base64 = store.getState().getEncodedStateBase64();
  if (base64) {
    localStorage.setItem(LOCAL_STORAGE_KEY, base64);
    store.setState({ hasPendingSave: false, lastSavedAt: Date.now() });
  }
}
