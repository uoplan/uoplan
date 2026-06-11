/**
 * Registers the application's service worker (built from `./sw.ts` by
 * `vite-plugin-pwa` in `injectManifest` mode). The SW handles push
 * notifications and notification clicks; there's no RPC surface, so no
 * Comlink wrapping is needed here (cf. `scheduleWorkerClient.ts`).
 *
 * Safe to call in SSR / non-browser environments — it no-ops when the
 * `serviceWorker` API is unavailable.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  // Service worker registration is best-effort and intentionally not surfaced to users.
  void (async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { type: "classic" });
    } catch (err) {
      // oxlint-disable-next-line no-console -- intentional best-effort service worker registration logging
      console.error(err);
    }
  })();
}
