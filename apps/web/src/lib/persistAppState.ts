import { LOCAL_STORAGE_KEY } from "../store/constants";
import { useAppStore } from "../store/appStore";

/** Write encoded app state to localStorage immediately (no debounce). */
export function flushPersistedAppState(): void {
  if (typeof window === "undefined") return;
  const base64 = useAppStore.getState().getEncodedStateBase64();
  if (base64) {
    localStorage.setItem(LOCAL_STORAGE_KEY, base64);
    useAppStore.setState({ hasPendingSave: false, lastSavedAt: Date.now() });
  }
}
