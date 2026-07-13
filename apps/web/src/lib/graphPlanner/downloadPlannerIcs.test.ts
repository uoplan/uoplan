import { describe, expect, test } from "vitest";
import type { DataCache } from "@uoplan/core";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import {
  buildAllTermsExportRequest,
  buildTermExportRequest,
  canDownloadTerm,
} from "./downloadPlannerIcs";
import type { PlannerTermDownload } from "./downloadPlannerIcs";

/**
 * Build a minimal schedule bundle whose single meeting either carries a dated
 * range (downloadable) or not. Cast through `unknown` because the real
 * `GeneratedSchedule` shape is far larger than what `computeScheduleDateBounds`
 * actually reads (enrollments → sectionCombo → section.times → meetingDates).
 */
function bundle(meetingDates?: string[]): GenerateSchedulesResult {
  return {
    currentSchedule: {
      enrollments: [
        {
          sectionCombo: {
            LEC: { section: { times: [{ meetingDates }] } },
          },
        },
      ],
    },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  } as unknown as GenerateSchedulesResult;
}

// `null` is a valid, real `DataCache | null` value (`scheduleToCalendarEvents`
// degrades gracefully without one) — using it keeps these fixtures simple while
// still verifying the cache reference/value flows through unchanged end-to-end.
const cache: DataCache | null = null;

describe("canDownloadTerm", () => {
  test("is false without a bundle or schedule", () => {
    expect(canDownloadTerm()).toBe(false);
    expect(canDownloadTerm({ currentSchedule: null } as unknown as GenerateSchedulesResult)).toBe(
      false,
    );
  });

  test("is false when meetings carry no dated range", () => {
    expect(canDownloadTerm(bundle())).toBe(false);
    expect(canDownloadTerm(bundle([]))).toBe(false);
  });

  test("is true once a meeting has a start/end date pair", () => {
    expect(canDownloadTerm(bundle(["2025-01-06", "2025-04-04"]))).toBe(true);
  });
});

describe("buildTermExportRequest", () => {
  test("returns null when the term has no dated schedule", () => {
    const term: PlannerTermDownload = { termId: "2261", label: "Winter 2026", bundle: undefined };
    expect(buildTermExportRequest(term, cache)).toBeNull();
  });

  test("returns a single-scope request with exact key, schedule, bounds, cache, and filename", () => {
    const termBundle = bundle(["2026-01-12", "2026-04-15"]);
    const term: PlannerTermDownload = { termId: "2261", label: "Winter 2026", bundle: termBundle };

    const request = buildTermExportRequest(term, cache);

    expect(request).not.toBeNull();
    expect(request?.scope).toBe("single");
    expect(request?.cache).toBe(cache);
    expect(request?.segments).toHaveLength(1);
    expect(request?.segments[0]).toEqual({
      key: "2261",
      schedule: termBundle.currentSchedule,
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });
    // Preserves the schedule reference exactly (no cloning/reselection).
    expect(request?.segments[0].schedule).toBe(termBundle.currentSchedule);
    expect(request?.filename).toBe("uoplan-winter-2026-2026-01-12-to-2026-04-15.ics");
  });
});

describe("buildAllTermsExportRequest", () => {
  test("returns null when no term is downloadable", () => {
    const terms: PlannerTermDownload[] = [
      { termId: "2259", label: "Fall 2025", bundle: undefined },
      { termId: "2261", label: "Winter 2026", bundle: bundle([]) },
    ];
    expect(buildAllTermsExportRequest(terms, cache)).toBeNull();
  });

  test("includes each downloadable term exactly once, in input order, with its own bounds", () => {
    const fallBundle = bundle(["2025-09-03", "2025-12-05"]);
    const winterBundle = bundle(["2026-01-12", "2026-04-15"]);
    const terms: PlannerTermDownload[] = [
      { termId: "2259", label: "Fall 2025", bundle: fallBundle },
      { termId: "2999", label: "Empty term", bundle: undefined },
      { termId: "2998", label: "No dates term", bundle: bundle([]) },
      { termId: "2261", label: "Winter 2026", bundle: winterBundle },
    ];

    const request = buildAllTermsExportRequest(terms, cache);

    expect(request).not.toBeNull();
    expect(request?.scope).toBe("all");
    expect(request?.cache).toBe(cache);
    // Stable order, each active/downloadable term exactly once; inactive/empty terms omitted.
    expect(request?.segments.map((s) => s.key)).toEqual(["2259", "2261"]);
    expect(request?.segments[0]).toEqual({
      key: "2259",
      schedule: fallBundle.currentSchedule,
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });
    expect(request?.segments[1]).toEqual({
      key: "2261",
      schedule: winterBundle.currentSchedule,
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });
    // Filename spans the min start / max end across included segments only.
    expect(request?.filename).toBe("uoplan-plan-2025-09-03-to-2026-04-15.ics");
  });
});

describe("deprecated immediate-download wrappers", () => {
  test("downloadTermIcs / downloadAllTermsIcs are no longer exported once graph planner call sites use ScheduleExportDialog", async () => {
    // DegreePlannerPage is migrated to `usePlannerScheduleExport` +
    // `ScheduleExportDialog` — the pure request builders + `canDownloadTerm`
    // remain the only exports graph planner callers use.
    const mod: Record<string, unknown> = await import("./downloadPlannerIcs");
    expect(mod.downloadTermIcs).toBeUndefined();
    expect(mod.downloadAllTermsIcs).toBeUndefined();
  });
});
