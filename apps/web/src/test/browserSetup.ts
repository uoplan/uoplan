import "@mantine/core/styles.css";
import "../styles/global.css";

import { beforeAll } from "vitest";

import { initializeI18n } from "../i18n";

/**
 * Browser-mode test setup. Runs once before browser component tests.
 *
 * Activates the i18n catalog (components call `useLingui()`/`tr()`), and
 * provides browser API shims that Mantine/Framer Motion expect but that the
 * headless test browser may not fully implement.
 */
beforeAll(async () => {
  await initializeI18n();

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
