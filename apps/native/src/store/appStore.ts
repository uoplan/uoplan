import { createAppStore as createPackageAppStore } from "@uoplan/store/appStore";
import type { AppServices } from "@uoplan/store/services";

import { createNativeAppServices } from "./nativeServices";

/** Build an isolated native app store wired to native AppServices. */
export function createAppStore(services: AppServices = createNativeAppServices()) {
  return createPackageAppStore(services);
}

export { useAppStore, useAppStoreApi } from "@uoplan/store/appStore";
export type { AppStoreApi } from "@uoplan/store/appStore";
