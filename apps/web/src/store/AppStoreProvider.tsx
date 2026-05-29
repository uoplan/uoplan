import type { ReactNode } from "react";
import { AppStoreContext, type AppStoreApi } from "./appStore";

/**
 * Provides an {@link AppStoreApi} instance to the React tree. Production wraps the app with the
 * `defaultAppStore`; tests pass a fresh `createAppStore()` per test for full isolation.
 */
export function AppStoreProvider({ store, children }: { store: AppStoreApi; children: ReactNode }) {
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}
