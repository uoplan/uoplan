import type { ReactNode } from "react";
import { I18nProvider } from "@lingui/react";
import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";
import { render } from "vitest-browser-react";
import { createTestAppServices } from "@uoplan/store/testServices";
import type { AppServiceOverrides } from "@uoplan/store/services";

import { i18n } from "../i18n";
import { AppThemeProvider } from "../theme/AppThemeProvider";
import { AppStoreProvider } from "@uoplan/store/AppStoreProvider";
import { createAppStore } from "../store/appStore";
import type { AppStoreApi } from "../store/appStore";
import type { AppStore } from "@uoplan/store/types";

interface TestProviderOptions {
  /** A fresh store to back the tree. Defaults to a new isolated `createAppStore()`. */
  store?: AppStoreApi;
  /** Service overrides merged into package test services when constructing a default store. */
  services?: AppServiceOverrides;
  /** Partial state merged into the store before rendering, for seeding fixtures. */
  initialState?: Partial<AppStore>;
}

/**
 * Wraps a component under test in the same providers the app mounts at the root
 * (Mantine theme, Lingui i18n, an isolated app store) plus
 * `MotionConfig reducedMotion="always"` to disable Framer Motion animations.
 *
 * Each call gets its OWN store instance (created outside render) so tests are fully
 * isolated. Deliberately omits the TanStack Router and the data-loading root layout;
 * routing is injected per-test via the navigation service where needed.
 */
function AppTestProviders({ children, store }: { children: ReactNode; store: AppStoreApi }) {
  return (
    <I18nProvider i18n={i18n}>
      <AppThemeProvider initialSelection="dark">
        <AppStoreProvider store={store}>
          <MotionConfig reducedMotion="always">
            <LazyMotion features={domAnimation}>{children}</LazyMotion>
          </MotionConfig>
        </AppStoreProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}

/**
 * Render a component wrapped in the standard app test providers against an isolated
 * store. Returns the render result plus the `store` so tests can seed/inspect state.
 */
export async function renderWithProviders(ui: ReactNode, options: TestProviderOptions = {}) {
  const store = options.store ?? createAppStore(createTestAppServices(options.services));
  if (options.initialState) {
    store.setState(options.initialState);
  }
  const result = await render(<AppTestProviders store={store}>{ui}</AppTestProviders>);
  const rerender = (newUi: ReactNode) =>
    result.rerender(<AppTestProviders store={store}>{newUi}</AppTestProviders>);
  return { store, ...result, rerender };
}
