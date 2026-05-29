import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setRouterInstance } from "./routerRef";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import "@fontsource/dm-mono/300.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/dm-serif-display/400.css";
import "./styles/global.css";
import { i18n, initializeI18n } from "./i18n";
import { registerServiceWorker } from "./workers/serviceWorkerClient";
import { AppStoreProvider } from "./store/AppStoreProvider";
import { defaultAppStore } from "./store/appStore";

await initializeI18n();

const router = createRouter({ routeTree });
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
        <AppStoreProvider store={defaultAppStore}>
          <RouterProvider router={router} />
        </AppStoreProvider>
      </AppThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
