import type { EventContext, LogEvent, LogLevel, SinkEvent } from "./messages";

/**
 * Context-agnostic reporter. Each extension context builds one with a `dispatch`
 * sink: content/popup dispatch via `browser.runtime.sendMessage` (relayed by the
 * background to the dev log-sink); the background dispatches straight into its
 * own batch queue. This keeps a single code path for emitting log/net/dom events
 * regardless of where they originate.
 */
export interface Reporter {
  log(level: LogLevel, message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Emit a pre-built event (net/dom snapshots, or a fully-formed log). */
  emit(event: SinkEvent): void;
}

export interface ReporterOptions {
  source: EventContext["source"];
  dispatch: (event: SinkEvent) => void;
  /** Resolves the current frame context (url / inFrame) at emit time. */
  getContext?: () => Pick<EventContext, "url" | "inFrame">;
  /** Also mirror logs to the local console (visible in DevTools). Default true. */
  mirrorConsole?: boolean;
}

export function createReporter(options: ReporterOptions): Reporter {
  const { source, dispatch, getContext, mirrorConsole = true } = options;

  function context(): Pick<EventContext, "url" | "inFrame"> {
    try {
      return getContext?.() ?? {};
    } catch {
      return {};
    }
  }

  function emit(event: SinkEvent): void {
    try {
      dispatch(event);
    } catch {
      // Never let logging break the host page or the worker.
    }
  }

  function log(level: LogLevel, message: string): void {
    if (mirrorConsole) {
      const sink = console[level] ?? console.log;
      sink(`[uoplan:${source}] ${message}`);
    }
    const entry: LogEvent = { type: "log", ts: Date.now(), level, message, source, ...context() };
    emit(entry);
  }

  return {
    log,
    debug: (m) => log("debug", m),
    info: (m) => log("info", m),
    warn: (m) => log("warn", m),
    error: (m) => log("error", m),
    emit,
  };
}
