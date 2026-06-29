import browser from "webextension-polyfill";
import { SINK_URL } from "../shared/config";
import { createReporter } from "../shared/log";
import type { Command, GradeBadge, GradesForCoursesResult, SinkEvent } from "../shared/messages";
import { loadGrades } from "../shared/grades";
import type { LoadedGrades } from "../shared/grades";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import {
  aPlusPercent,
  countedMass,
  distributionGpa,
  gpaToLetterGrade,
} from "@uoplan/core/gradeDistribution";

/**
 * Background service worker — the extension's hub.
 *   - Batches log/net/dom events (its own + relayed from content/popup) and
 *     POSTs them to the local dev log-sink so the agent sees everything live.
 *   - Routes popup commands (dump DOM in the active tab, load grades).
 *
 * It holds the cross-origin `host_permissions`, so all outbound fetches (sink +
 * uoPlan data) run here, never in a content script.
 */

const FLUSH_DEBOUNCE_MS = 250;
const MAX_BATCH = 25;

const queue: SinkEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let sinkHealthy = true;

async function flush(): Promise<void> {
  flushTimer = undefined;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await fetch(SINK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    sinkHealthy = true;
  } catch {
    // Sink not running: drop the batch (it's a dev diagnostic, not critical) but
    // remember so the popup can show that the sink is unreachable.
    sinkHealthy = false;
  }
}

function scheduleFlush(): void {
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  flushTimer ??= setTimeout(() => void flush(), FLUSH_DEBOUNCE_MS);
}

function enqueue(event: SinkEvent): void {
  queue.push(event);
  scheduleFlush();
}

const reporter = createReporter({ source: "background", dispatch: enqueue });

/** Memoize the in-flight/loaded grade payload so concurrent overlays share one fetch. */
let gradesPromise: Promise<LoadedGrades> | undefined;
async function getGrades(): Promise<LoadedGrades> {
  if (gradesPromise) return gradesPromise;
  gradesPromise = loadGrades();
  try {
    return await gradesPromise;
  } catch (err) {
    gradesPromise = undefined; // allow retry on failure
    throw err;
  }
}

/** Build a {@link GradeBadge} from a course-aggregate distribution, or null. */
function badgeFor(grades: LoadedGrades, code: string): GradeBadge | undefined {
  const dist = grades.lookups.aggregateByCourse.get(normalizeCourseCode(code));
  if (!dist) return undefined;
  const count = countedMass(dist);
  if (count <= 0) return undefined;
  return {
    gpa: distributionGpa(dist),
    letter: gpaToLetterGrade(distributionGpa(dist)),
    aPlusPct: aPlusPercent(dist),
    count,
  };
}

function isSinkEvent(value: unknown): value is SinkEvent {
  const type = (value as { type?: string }).type;
  return type === "log" || type === "net" || type === "dom";
}

function isCommand(value: unknown): value is Command {
  return (value as { type?: string }).type === "cmd";
}

async function handleCommand(command: Command): Promise<unknown> {
  switch (command.name) {
    case "ping":
      return { ok: true, sinkHealthy, queued: queue.length };

    case "dump-dom": {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) return { ok: false, error: "no active tab" };
      // Delivered to the content script in every frame of the tab.
      try {
        await browser.tabs.sendMessage(tab.id, command);
      } catch {
        // Some frames (e.g. about:blank) may have no content script; ignore.
      }
      reporter.info(`requested DOM dump for tab ${tab.id} (${tab.url ?? "?"})`);
      return { ok: true };
    }

    case "load-grades": {
      try {
        const result = await getGrades();
        const summary = {
          baseUrl: result.baseUrl,
          fromCache: result.fromCache,
          courseCount: result.courseCount,
          sectionCount: result.sectionCount,
        };
        const cache = summary.fromCache ? " (cache)" : "";
        reporter.info(
          `grades loaded from ${summary.baseUrl}${cache}: ${summary.courseCount} courses, ${summary.sectionCount} sections`,
        );
        return { ok: true, summary };
      } catch (err) {
        const message = (err as Error).message;
        reporter.error(`grade load failed: ${message}`);
        return { ok: false, error: message };
      }
    }

    case "grades-for-courses": {
      try {
        const grades = await getGrades();
        const byCode: Record<string, GradeBadge> = {};
        for (const code of command.codes) {
          const badge = badgeFor(grades, code);
          if (badge) byCode[code] = badge;
        }
        reporter.info(
          `grades-for-courses: ${command.codes.length} codes → ${Object.keys(byCode).length} matched (src ${grades.baseUrl})`,
        );
        return { ok: true, baseUrl: grades.baseUrl, byCode } satisfies GradesForCoursesResult;
      } catch (err) {
        const message = (err as Error).message;
        reporter.error(`grades-for-courses failed: ${message}`);
        return { ok: false, error: message } satisfies GradesForCoursesResult;
      }
    }
  }
}

browser.runtime.onMessage.addListener((message: unknown): Promise<unknown> | undefined => {
  if (isSinkEvent(message)) {
    enqueue(message);
    return;
  }
  if (isCommand(message)) {
    return handleCommand(message);
  }
  return;
});

browser.runtime.onInstalled.addListener(() => {
  reporter.info(`uoPlan extension installed; streaming logs to ${SINK_URL}`);
});

reporter.info("background service worker started");
