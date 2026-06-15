import React from "react";
import ReactDOM from "react-dom/client";
import { Notifications } from "@mantine/notifications";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { shouldEnablePreload } from "./lib/preloadStrategy";
import { routeTree } from "./routeTree.gen";
import { setRouterInstance } from "./routerRef";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import "@fontsource/dm-mono/300.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/dm-serif-display/400.css";
import "./styles/global.css";
import { i18n, I18nProvider, initializeI18n } from "./i18n";
import { registerServiceWorker } from "./workers/serviceWorkerClient";
import { printConsoleGreeting } from "./lib/easterEggs/consoleGreeting";
import { AppStoreProvider } from "./store/AppStoreProvider";
import { defaultAppStore } from "./store/appStore";

await initializeI18n();

printConsoleGreeting();

const router = createRouter({
  routeTree,
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
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AppStoreProvider>
      </AppThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
