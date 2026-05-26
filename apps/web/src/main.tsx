import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { I18nProvider } from "@lingui/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setRouterInstance } from "./routerRef";
import { theme } from "./styles/theme";
import "@fontsource/dm-mono/300.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/dm-serif-display/400.css";
import "./styles/global.css";
import { i18n, initializeI18n } from "./i18n";

await initializeI18n();

const router = createRouter({ routeTree });
setRouterInstance(router);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(console.error);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <RouterProvider router={router} />
      </MantineProvider>
    </I18nProvider>
  </React.StrictMode>,
);
