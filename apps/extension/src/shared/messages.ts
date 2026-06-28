/**
 * Typed message contracts exchanged between extension contexts.
 *
 * Flow:
 *   content/popup ──(browser.runtime.sendMessage)──▶ background ──(fetch)──▶ sink
 *   page (MAIN world inject) ──(window.postMessage)──▶ content ──▶ background
 *
 * Everything the background relays to the dev log-sink is a {@link SinkEvent};
 * commands sent the other way (background/popup → content/background) are
 * {@link Command}s.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Identifies which context/frame an event originated from. */
export interface EventContext {
  /** Logical source: background SW, content script, page hook, or popup. */
  source: "background" | "content" | "page" | "popup";
  /** Document URL of the originating frame (when known). */
  url?: string;
  /** True when the originating frame is not the top frame (PeopleSoft iframes). */
  inFrame?: boolean;
}

/** A console/diagnostic line. */
export interface LogEvent extends EventContext {
  type: "log";
  ts: number;
  level: LogLevel;
  message: string;
}

/** A captured page network call (fetch / XHR) from the MAIN-world hook. */
export interface NetEvent extends EventContext {
  type: "net";
  ts: number;
  api: "fetch" | "xhr";
  method: string;
  requestUrl: string;
  status?: number;
  durationMs?: number;
  ok?: boolean;
  /** Trimmed response content-type, when observable. */
  contentType?: string;
  error?: string;
}

/** A serialized DOM/iframe structure snapshot of a single frame. */
export interface DomEvent extends EventContext {
  type: "dom";
  ts: number;
  title: string;
  /** Compact, depth-limited outline of the frame's DOM (see content/collect). */
  outline: string;
  /** Count of notable PeopleSoft markers found (iframes, win0 forms, tables). */
  markers: Record<string, number>;
}

/** Anything the background relays to the dev log-sink. */
export type SinkEvent = LogEvent | NetEvent | DomEvent;

/** Commands sent toward the background or content scripts. */
export type Command =
  | { type: "cmd"; name: "dump-dom" }
  | { type: "cmd"; name: "load-grades" }
  | { type: "cmd"; name: "ping" };
