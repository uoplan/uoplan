import browser from "webextension-polyfill";
import { createReporter } from "../shared/log";
import type { NetEvent, SinkEvent } from "../shared/messages";
import { collectDom } from "./collect";
import { startGradeOverlay } from "./overlay";

/**
 * Isolated-world content script (runs in EVERY frame — PeopleSoft nests the real
 * UI inside `ptifrmtgtframe`). Responsibilities:
 *   1. relay log/dom/net events to the background (which forwards to the sink);
 *   2. receive page-network captures from the MAIN-world hook (`inject.ts`) via
 *      `window.postMessage` and forward them;
 *   3. dump this frame's DOM/iframe structure on load and on demand.
 */

const inFrame = window.self !== window.top;

const reporter = createReporter({
  source: "content",
  dispatch: (event: SinkEvent) => {
    // Fire-and-forget; the background owns batching + delivery to the sink.
    void deliver(event);
  },
  getContext: () => ({ url: location.href, inFrame }),
});

/** Send one event to the background, swallowing "no receiver" races. */
async function deliver(event: SinkEvent): Promise<void> {
  try {
    await browser.runtime.sendMessage(event);
  } catch {
    // Background may be asleep/reloading; logging is best-effort.
  }
}

/** Capture page fetch/XHR posted up from the MAIN-world hook. */
interface InjectNetMessage {
  __uoplan: "net";
  entry: Omit<NetEvent, "source" | "url" | "inFrame">;
}

function isInjectNetMessage(data: unknown): data is InjectNetMessage {
  return (
    typeof data === "object" && data !== null && (data as { __uoplan?: unknown }).__uoplan === "net"
  );
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!isInjectNetMessage(event.data)) return;
  reporter.emit({ ...event.data.entry, source: "page", url: location.href, inFrame });
});

function dumpDom(): void {
  reporter.emit(collectDom(document, inFrame));
}

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type?: string; name?: string };
  if (msg?.type === "cmd" && msg.name === "dump-dom") dumpDom();
});

reporter.info(`content script attached (${inFrame ? "iframe" : "top"}): ${location.href}`);

// PeopleSoft hydrates content frames asynchronously, so dump on load and again
// shortly after to capture the populated DOM.
function scheduleInitialDumps(): void {
  dumpDom();
  setTimeout(dumpDom, 1500);
  startGradeOverlay(document, (m) => reporter.info(m));
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  scheduleInitialDumps();
} else {
  window.addEventListener("DOMContentLoaded", scheduleInitialDumps, { once: true });
}
