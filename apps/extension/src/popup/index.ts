import browser from "webextension-polyfill";
import type { Command } from "../shared/messages";

/**
 * Minimal popup UI (vanilla TS — no React in Phase 1). Each button sends a
 * {@link Command} to the background and shows the response. The real grade
 * overlay UI is a later phase.
 */

const statusEl = document.querySelector<HTMLDivElement>("#status");

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

async function send(command: Command): Promise<void> {
  setStatus("Working…");
  try {
    const response = await browser.runtime.sendMessage(command);
    setStatus(JSON.stringify(response, null, 2));
  } catch (err) {
    setStatus(`Error: ${(err as Error).message}`);
  }
}

document.querySelector("#dump")?.addEventListener("click", () => {
  void send({ type: "cmd", name: "dump-dom" });
});
document.querySelector("#grades")?.addEventListener("click", () => {
  void send({ type: "cmd", name: "load-grades" });
});
document.querySelector("#ping")?.addEventListener("click", () => {
  void send({ type: "cmd", name: "ping" });
});
