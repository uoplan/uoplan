import type { AppServices } from "@uoplan/store/services";
import { createAppStore as createPackageAppStore } from "@uoplan/store/appStore";
import { createWebAppServices } from "./webServices";
import { registerAppStore } from "./storeRegistry";

export { useAppStore, useAppStoreApi } from "@uoplan/store/appStore";
export type { AppStoreApi } from "@uoplan/store/appStore";

/** Build an isolated web app store using the package factory wired to web services. */
export function createAppStore(services: AppServices = createWebAppServices()) {
  return createPackageAppStore(services);
}

/** Default singleton store used by the running app and by non-React/imperative callers. */
export const defaultAppStore = createAppStore();
registerAppStore(defaultAppStore);
