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

/**
 * A parsed class-search / component row — the grade-overlay's anchor point.
 * Mirrors the ids apps/cli parses: `MTG_CLASS_NBR$N`, `MTG_CLASSNAME$N`,
 * `MTG_DAYTIME$N`, `MTG_INSTR$N`, plus companion rows `trSSR_CLS_TBL_R*`.
 */
export interface SectionRow {
  /** Origin: search results (`MTG_*`) or a component sub-table (`SSR_CLS_TBL`). */
  kind: "search" | "component";
  index: number;
  classNbr: string;
  /** Raw section label, e.g. "ADM1100-A LEC". */
  name: string;
  /** Normalized course code parsed from `name`, e.g. "ADM1100". */
  courseCode?: string;
  days: string;
  instructor: string;
  status: string;
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
  /** Parsed class rows, when the frame is a class-search/results/component page. */
  sections?: SectionRow[];
}

/** Anything the background relays to the dev log-sink. */
export type SinkEvent = LogEvent | NetEvent | DomEvent;

/** Compact grade summary for one course code, sent content ← background. */
export interface GradeBadge {
  /** Mean GPA across all professor rows for the course, or null. */
  gpa: number | null;
  /** Letter grade for `gpa` (e.g. "A-"), or null. */
  letter: string | null;
  /** Percentage of A+ grades, 0–100, or null. */
  aPlusPct: number | null;
  /** Total counted grade mass behind the distribution. */
  count: number;
}

/** Commands sent toward the background or content scripts. */
export type Command =
  | { type: "cmd"; name: "dump-dom" }
  | { type: "cmd"; name: "load-grades" }
  | { type: "cmd"; name: "grades-for-courses"; codes: string[] }
  | { type: "cmd"; name: "ping" };

/** Background reply to a `grades-for-courses` command. */
export interface GradesForCoursesResult {
  ok: boolean;
  error?: string;
  baseUrl?: string;
  /** Normalized course code → badge (only codes with data are present). */
  byCode?: Record<string, GradeBadge>;
}
