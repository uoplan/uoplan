import type { NetEvent } from "../shared/messages";

/**
 * MAIN-world page hook. Runs in the page's own JS context (NOT the isolated
 * content-script world) so it can observe the page's `fetch` / `XMLHttpRequest`
 * — this is how we capture PeopleSoft's data calls. It has NO extension API
 * access; it relays captures to the isolated content script via
 * `window.postMessage`, which forwards them to the background → sink.
 */

type NetEntry = Omit<NetEvent, "source" | "url" | "inFrame">;

const MARKER = "__uoplanNetHookInstalled";

declare global {
  interface Window {
    [MARKER]?: boolean;
  }
}

function post(entry: NetEntry): void {
  try {
    window.postMessage({ __uoplan: "net", entry }, "*");
  } catch {
    // Ignore: never disturb the host page.
  }
}

function installFetchHook(): void {
  const original = window.fetch;
  if (typeof original !== "function") return;
  window.fetch = async function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>) {
    const [input, init] = args;
    const requestUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const start = performance.now();
    try {
      const response = await original.apply(this, args);
      post({
        type: "net",
        ts: Date.now(),
        api: "fetch",
        method,
        requestUrl,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - start),
        contentType: response.headers.get("content-type") ?? undefined,
      });
      return response;
    } catch (error) {
      post({
        type: "net",
        ts: Date.now(),
        api: "fetch",
        method,
        requestUrl,
        durationMs: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } as typeof fetch;
}

function installXhrHook(): void {
  const Xhr = window.XMLHttpRequest;
  if (typeof Xhr !== "function") return;
  // Capturing the original prototype methods to re-invoke via `.apply(this, …)`
  // is the standard XHR monkeypatch; `this` is always rebound at call time, so
  // the unbound-method warning is a false positive here.
  // oxlint-disable-next-line typescript/unbound-method
  const open = Xhr.prototype.open;
  // oxlint-disable-next-line typescript/unbound-method
  const send = Xhr.prototype.send;

  interface Tracked {
    __uoplanMethod?: string;
    __uoplanUrl?: string;
    __uoplanStart?: number;
  }

  Xhr.prototype.open = function patchedOpen(
    this: XMLHttpRequest & Tracked,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__uoplanMethod = String(method).toUpperCase();
    this.__uoplanUrl = typeof url === "string" ? url : url.href;
    // oxlint-disable-next-line typescript/no-explicit-any
    return open.apply(this, [method, url, ...rest] as any);
  } as typeof open;

  Xhr.prototype.send = function patchedSend(this: XMLHttpRequest & Tracked, ...rest: unknown[]) {
    this.__uoplanStart = performance.now();
    this.addEventListener("loadend", () => {
      post({
        type: "net",
        ts: Date.now(),
        api: "xhr",
        method: this.__uoplanMethod ?? "GET",
        requestUrl: this.__uoplanUrl ?? "",
        status: this.status,
        ok: this.status >= 200 && this.status < 400,
        durationMs:
          this.__uoplanStart === undefined
            ? undefined
            : Math.round(performance.now() - this.__uoplanStart),
        contentType: this.getResponseHeader("content-type") ?? undefined,
      });
    });
    // oxlint-disable-next-line typescript/no-explicit-any
    return send.apply(this, rest as any);
  } as typeof send;
}

if (!window[MARKER]) {
  window[MARKER] = true;
  installFetchHook();
  installXhrHook();
}
