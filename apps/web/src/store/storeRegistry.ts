import type { StoreApi } from "zustand/vanilla";
import type { AppStore } from "./types";

/**
 * Holds the running singleton store so imperative helpers (e.g.
 * `flushPersistedAppState` in lib/persistAppState) can reach it without
 * importing `appStore` directly — that would form an import cycle
 * (appStore → slices → schedules → persistAppState → appStore).
 */
let registered: StoreApi<AppStore> | null = null;

export function registerAppStore(store: StoreApi<AppStore>): void {
  registered = store;
}

export function getRegisteredAppStore(): StoreApi<AppStore> | null {
  return registered;
}
