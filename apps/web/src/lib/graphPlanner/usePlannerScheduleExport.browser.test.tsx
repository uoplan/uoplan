import { renderHook } from "vitest-browser-react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DataCache } from "@uoplan/core";
import type {
  ImportantDateItem,
  ImportantDatesData,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { realGraphPlannerBundle as realBundle } from "../../test/scheduleExportFixtures";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import type { PlannerTermDownload } from "./downloadPlannerIcs";
import { usePlannerScheduleExport } from "./usePlannerScheduleExport";
import type { UsePlannerScheduleExportResult } from "./usePlannerScheduleExport";

/**
 * Owner-level integration tests for the graph planner's schedule-export dialog
 * orchestration. Exercises the REAL pure request builders
 * (`buildTermExportRequest` / `buildAllTermsExportRequest`, via the hook) and
 * the REAL `buildScheduleExport` ICS pipeline end-to-end; only the three
 * approved boundaries are mocked: the important-dates loader
 * (`useImportantDates`), the browser download call (`downloadTextFile`), and
 * analytics (`useAnalytics`).
 */

const mocks = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
  capture: vi.fn(),
  useImportantDates: vi.fn(),
}));

vi.mock("../downloadFile", () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

vi.mock("../analytics", () => ({
  useAnalytics: () => ({ capture: mocks.capture }),
}));

vi.mock("../../hooks/useImportantDates", () => ({
  useImportantDates: mocks.useImportantDates,
}));

// ── fixtures ─────────────────────────────────────────────────────────────

/** A bundle with no dated meetings — not downloadable (mirrors `canDownloadTerm`'s false case). */
function undownloadableBundle(): GenerateSchedulesResult {
  return {
    currentSchedule: {
      enrollments: [{ sectionCombo: { LEC: { section: { times: [{ meetingDates: [] }] } } } }],
    },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  } as unknown as GenerateSchedulesResult;
}

function makeItem(
  effect: ImportantDateItem["effect"],
  overrides: Partial<ImportantDateItem> = {},
): ImportantDateItem {
  return { id: "item-1", topic: "Untitled", dateText: "", effect, ...overrides };
}

function makeTerm(
  termId: string,
  season: ImportantDateTerm["season"],
  year: number,
  items: ImportantDateItem[] = [],
): ImportantDateTerm {
  return {
    sourceId: `source-${termId}`,
    termId,
    label: `${season} ${year}`,
    season,
    year,
    sourcePublished: "true",
    termInterval: { startDate: "2026-01-01", endDate: "2026-04-30" },
    courseInterval: { startDate: "2026-01-12", endDate: "2026-04-13" },
    sessions: [],
    sections:
      items.length > 0
        ? [
            {
              id: "s1",
              label: "Important Dates",
              category: "breaks",
              groups: [{ id: "g1", items }],
            },
          ]
        : [],
  };
}

function makeData(terms: ImportantDateTerm[]): ImportantDatesData {
  return { locale: "en", sourceUrl: "https://example.test/dates", terms };
}

/** Winter 2026 term with a mandatory `no_classes` break plus an optional `deadline`. */
function winterTermWithBreakAndDeadline(): ImportantDateTerm {
  return makeTerm("2261", "winter", 2026, [
    makeItem("no_classes", {
      id: "family-day",
      topic: "Family Day",
      interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
    }),
    makeItem("deadline", {
      id: "add-drop",
      topic: "Add/drop deadline",
      interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
    }),
  ]);
}

const cache: DataCache | null = null;

function readyImportantDates(data: ImportantDatesData) {
  return { data, loading: false, error: null, retry: vi.fn() };
}

function loadingImportantDates() {
  return { data: null, loading: true, error: null, retry: vi.fn() };
}

function missingImportantDates() {
  return { data: null, loading: false, error: null, retry: vi.fn() };
}

function failedImportantDates(retry = vi.fn()) {
  return { data: null, loading: false, error: new Error("network failure"), retry };
}

const GENERIC_ERROR = "Calendar export failed. Please try again.";

async function captureError(promise: Promise<void>): Promise<Error> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  return caught as Error;
}

describe("usePlannerScheduleExport", () => {
  beforeEach(() => {
    mocks.downloadTextFile.mockReset();
    mocks.capture.mockReset();
    mocks.useImportantDates.mockReset();
    mocks.useImportantDates.mockReturnValue(
      readyImportantDates(makeData([winterTermWithBreakAndDeadline()])),
    );
  });

  describe("opening the dialog", () => {
    test("starts closed with no snapshot", async () => {
      const { result } = await renderHook(() => usePlannerScheduleExport(cache));

      expect(result.current.request).toBeNull();
      expect(result.current.scopeLabel).toBeUndefined();
    });

    test("openTermExport snapshots the single-term request and opens the dialog without downloading or tracking", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));

      await act(() => {
        result.current.openTermExport(term);
      });

      expect(result.current.request).not.toBeNull();
      expect(result.current.request?.scope).toBe("single");
      expect(result.current.request?.cache).toBe(cache);
      expect(result.current.request?.filename).toBe(
        "uoplan-winter-2026-2026-01-12-to-2026-04-15.ics",
      );
      expect(result.current.request?.segments).toEqual([
        {
          key: "2261",
          schedule: term.bundle?.currentSchedule,
          startDate: "2026-01-12",
          endDate: "2026-04-15",
        },
      ]);
      expect(result.current.scopeLabel).toBe("Winter 2026");
      expect(mocks.downloadTextFile).not.toHaveBeenCalled();
      expect(mocks.capture).not.toHaveBeenCalled();
    });

    test("openAllTermsExport snapshots the combined request in stable input order without downloading or tracking", async () => {
      const terms: PlannerTermDownload[] = [
        { termId: "2259", label: "Fall 2025", bundle: realBundle(["2025-09-03", "2025-12-05"]) },
        { termId: "2261", label: "Winter 2026", bundle: realBundle(["2026-01-12", "2026-04-15"]) },
      ];
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));

      await act(() => {
        result.current.openAllTermsExport(terms);
      });

      expect(result.current.request?.scope).toBe("all");
      expect(result.current.request?.segments.map((s) => s.key)).toEqual(["2259", "2261"]);
      expect(result.current.request?.filename).toBe("uoplan-plan-2025-09-03-to-2026-04-15.ics");
      // "All terms" doesn't carry a single-term scope label.
      expect(result.current.scopeLabel).toBeUndefined();
      expect(mocks.downloadTextFile).not.toHaveBeenCalled();
      expect(mocks.capture).not.toHaveBeenCalled();
    });

    test("openTermExport is a no-op when the term has no dated schedule (mirrors canDownloadTerm)", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: undownloadableBundle(),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));

      await act(() => {
        result.current.openTermExport(term);
      });

      expect(result.current.request).toBeNull();
    });

    test("openAllTermsExport is a no-op when nothing is downloadable", async () => {
      const terms: PlannerTermDownload[] = [
        { termId: "2261", label: "Winter 2026", bundle: undefined },
      ];
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));

      await act(() => {
        result.current.openAllTermsExport(terms);
      });

      expect(result.current.request).toBeNull();
    });

    test("close clears the snapshot and scope label", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));

      await act(() => {
        result.current.openTermExport(term);
      });
      expect(result.current.request).not.toBeNull();

      await act(() => {
        result.current.close();
      });

      expect(result.current.request).toBeNull();
      expect(result.current.scopeLabel).toBeUndefined();
    });
  });

  describe("snapshot immutability while open", () => {
    test("a planner/prop change after opening does not alter the already-snapshotted request", async () => {
      const cacheA: DataCache | null = null;
      const cacheB: DataCache | null = { id: "different-cache" } as unknown as DataCache;
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };

      const { result, act, rerender } = await renderHook<
        { cache: DataCache | null },
        UsePlannerScheduleExportResult
      >((props) => usePlannerScheduleExport(props?.cache ?? null), {
        initialProps: { cache: cacheA },
      });

      await act(() => {
        result.current.openTermExport(term);
      });
      const snapshot = result.current.request;
      expect(snapshot?.cache).toBe(cacheA);

      // Simulate the planner's cache (or any other input) changing while the
      // dialog stays open — the snapshot must not be recomputed.
      await rerender({ cache: cacheB });

      expect(result.current.request).toBe(snapshot);
      expect(result.current.request?.cache).toBe(cacheA);
    });
  });

  describe("onExport: important-dates loader state", () => {
    test("loading blocks the export with a localized error, no download, no retry", async () => {
      mocks.useImportantDates.mockReturnValue(loadingImportantDates());
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      const error = await captureError(result.current.onExport({ includeDeadlines: false }));

      expect(error.message).toBe(GENERIC_ERROR);
      expect(mocks.downloadTextFile).not.toHaveBeenCalled();
      expect(mocks.capture).not.toHaveBeenCalled();
    });

    test("missing data with no error blocks the export with a localized error", async () => {
      mocks.useImportantDates.mockReturnValue(missingImportantDates());
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      const error = await captureError(result.current.onExport({ includeDeadlines: false }));

      expect(error.message).toBe(GENERIC_ERROR);
      expect(mocks.downloadTextFile).not.toHaveBeenCalled();
    });

    test("a loader failure retries exactly once per export attempt (never from an effect), so a later attempt can succeed", async () => {
      const retry = vi.fn();
      mocks.useImportantDates.mockReturnValue(failedImportantDates(retry));

      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act, rerender } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      // No auto-retry just from rendering / opening the dialog.
      expect(retry).not.toHaveBeenCalled();

      await captureError(result.current.onExport({ includeDeadlines: false }));
      expect(retry).toHaveBeenCalledOnce();

      // A second attempt while still failed retries again — once per attempt, not a loop.
      await captureError(result.current.onExport({ includeDeadlines: false }));
      expect(retry).toHaveBeenCalledTimes(2);

      // Simulate the retry succeeding: the loader now reports ready data.
      mocks.useImportantDates.mockReturnValue(
        readyImportantDates(makeData([winterTermWithBreakAndDeadline()])),
      );
      await rerender();

      await result.current.onExport({ includeDeadlines: false });
      expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
      // Succeeding must not trigger another retry call.
      expect(retry).toHaveBeenCalledTimes(2);
    });
  });

  describe("onExport: mandatory transforms + deadlines", () => {
    test("single-term export: mandatory no_classes closure always applies even when deadlines are unchecked", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      await result.current.onExport({ includeDeadlines: false });

      expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
      const [filename, ics, mimeType] = mocks.downloadTextFile.mock.calls[0];
      expect(filename).toBe("uoplan-winter-2026-2026-01-12-to-2026-04-15.ics");
      expect(mimeType).toBe("text/calendar;charset=utf-8");
      // 1 course event + 1 mandatory all-day closure marker; no deadline row.
      expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
      expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
      expect(ics).not.toContain("Add/drop deadline");
      expect(mocks.capture).toHaveBeenCalledOnce();
      expect(mocks.capture).toHaveBeenCalledWith("schedule_exported", { target: "ics" });
    });

    test("single-term export: checking includeDeadlines also includes the matching deadline row", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      await result.current.onExport({ includeDeadlines: true });

      const [, ics] = mocks.downloadTextFile.mock.calls[0];
      expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
      expect(ics).toContain("SUMMARY:Add/drop deadline\r\n");
    });

    test("all-terms export: each term's own transforms apply with no cross-term leakage, stable order, prefixed UIDs", async () => {
      const fallTerm = makeTerm("2259", "fall", 2025, [
        makeItem("no_classes", {
          id: "fall-break",
          topic: "Fall break",
          interval: { startDate: "2025-10-13", endDate: "2025-10-13" },
        }),
      ]);
      const winterTerm = makeTerm("2261", "winter", 2026, [
        makeItem("no_classes", {
          id: "family-day",
          topic: "Family Day",
          interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
        }),
      ]);
      mocks.useImportantDates.mockReturnValue(
        readyImportantDates(makeData([fallTerm, winterTerm])),
      );

      const terms: PlannerTermDownload[] = [
        { termId: "2259", label: "Fall 2025", bundle: realBundle(["2025-09-03", "2025-12-05"]) },
        { termId: "2261", label: "Winter 2026", bundle: realBundle(["2026-01-12", "2026-04-15"]) },
      ];
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openAllTermsExport(terms);
      });

      await result.current.onExport({ includeDeadlines: false });

      expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
      const [filename, ics] = mocks.downloadTextFile.mock.calls[0];
      expect(filename).toBe("uoplan-plan-2025-09-03-to-2026-04-15.ics");
      // Two course events plus one all-day marker per segment — never the other segment's rule.
      expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
      expect(ics).toContain("UID:2259-CSI 2132-LEC-Mo-540-600@uoplan");
      expect(ics).toContain("UID:2261-CSI 2132-LEC-Mo-540-600@uoplan");
      expect(ics).toContain("SUMMARY:Fall break\r\n");
      expect(ics).toContain("SUMMARY:Family Day\r\n");
      expect(ics).toContain("EXDATE;TZID=America/Toronto:20251013T090000\r\n");
      expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
    });
  });

  describe("onExport: failure handling", () => {
    test("a segment with no matching important-date term blocks the whole export: normalized error, no download, no analytics, snapshot retained", async () => {
      // Important-dates data only has the fall term — winter (2261) has no match.
      mocks.useImportantDates.mockReturnValue(
        readyImportantDates(makeData([makeTerm("2259", "fall", 2025)])),
      );

      const terms: PlannerTermDownload[] = [
        { termId: "2259", label: "Fall 2025", bundle: realBundle(["2025-09-03", "2025-12-05"]) },
        { termId: "2261", label: "Winter 2026", bundle: realBundle(["2026-01-12", "2026-04-15"]) },
      ];
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openAllTermsExport(terms);
      });

      const error = await captureError(result.current.onExport({ includeDeadlines: false }));

      // Normalized: the raw "no term matches ... 2261" technical message must not leak.
      expect(error.message).toBe(GENERIC_ERROR);
      expect(error.message).not.toContain("2261");
      expect(mocks.downloadTextFile).not.toHaveBeenCalled();
      expect(mocks.capture).not.toHaveBeenCalled();
      // The dialog stays open — the snapshot is untouched by a failed attempt.
      expect(result.current.request).not.toBeNull();
    });

    test("a download-boundary failure is normalized and fires no analytics", async () => {
      mocks.downloadTextFile.mockImplementation(() => {
        throw new Error("Blob API is not available in this browser");
      });
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      const error = await captureError(result.current.onExport({ includeDeadlines: false }));

      expect(error.message).toBe(GENERIC_ERROR);
      expect(error.message).not.toContain("Blob API");
      expect(mocks.capture).not.toHaveBeenCalled();
    });
  });

  describe("onExport: success", () => {
    test("downloads with the exact ics/filename and fires schedule_exported analytics exactly once, only after a successful download", async () => {
      const term: PlannerTermDownload = {
        termId: "2261",
        label: "Winter 2026",
        bundle: realBundle(["2026-01-12", "2026-04-15"]),
      };
      const { result, act } = await renderHook(() => usePlannerScheduleExport(cache));
      await act(() => {
        result.current.openTermExport(term);
      });

      await result.current.onExport({ includeDeadlines: false });

      expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
      expect(mocks.capture).toHaveBeenCalledOnce();
      const downloadOrder = mocks.downloadTextFile.mock.invocationCallOrder[0];
      const captureOrder = mocks.capture.mock.invocationCallOrder[0];
      expect(downloadOrder).toBeLessThan(captureOrder);
    });
  });
});
