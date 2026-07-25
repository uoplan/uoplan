import React from "react";
import ReactDOM from "react-dom/client";
import { Notifications } from "@mantine/notifications";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { AnalyticsProvider } from "./lib/analytics";
import { shouldEnablePreload } from "./lib/preloadStrategy";
import { routeTree } from "./routeTree.gen";
import { setRouterInstance } from "./routerRef";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/dm-serif-display/400.css";
import "./styles/global.css";
import { i18n, I18nProvider, initializeI18n } from "./i18n";
import { registerServiceWorker } from "./workers/serviceWorkerClient";
import { printConsoleGreeting } from "./lib/easterEggs/consoleGreeting";
import { AppStoreProvider } from "@uoplan/store/AppStoreProvider";
import { SCHOOLS } from "@uoplan/domain/school";
import { initializeActiveSchool } from "./lib/activeSchool";
import { defaultAppStore } from "./store/appStore";

await initializeI18n();

printConsoleGreeting();

// Must run before `createRouter` — the basepath, the `.pb` asset namespace and
// the localStorage key all derive from it, and the router needs it up front.
const activeSchool = initializeActiveSchool();

const router = createRouter({
  routeTree,
  // uOttawa's slug is "", so its basepath stays "/" and every existing URL is
  // byte-identical; Carleton gets "/carleton" and every <Link> inherits it.
  basepath:
    SCHOOLS[activeSchool].pathSlug === "" ? undefined : `/${SCHOOLS[activeSchool].pathSlug}`,
  defaultPreload: shouldEnablePreload(),
  defaultPreloadDelay: 50,
});
setRouterInstance(router);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <AppThemeProvider>
        <Notifications />
        <AppStoreProvider store={defaultAppStore}>
          <AnalyticsProvider>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
          </AnalyticsProvider>
        </AppStoreProvider>
      </AppThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
