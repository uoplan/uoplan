import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { I18nProvider } from "@lingui/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setRouterInstance } from "./routerRef";
import { theme } from "./styles/theme";
import "./styles/global.css";
import { i18n, initializeI18n } from "./i18n";

await initializeI18n();

const router = createRouter({ routeTree });
setRouterInstance(router);

// Patch history to trigger view transitions immediately on navigation —
// before TanStack Router's async pipeline — so the screenshot is captured
// at the moment the user acts, not 1s later after loaders resolve.
if (typeof document !== "undefined" && "startViewTransition" in document) {
  const hist = router.history;
  const origPush = hist.push.bind(hist);
  const origReplace = hist.replace.bind(hist);
  const svt = (fn: () => void) =>
    (document as Document & { startViewTransition(cb: () => void): void }).startViewTransition(fn);
  hist.push = (to, state) => svt(() => origPush(to, state));
  hist.replace = (to, state) => svt(() => origReplace(to, state));
}

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
