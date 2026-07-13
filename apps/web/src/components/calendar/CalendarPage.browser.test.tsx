import { page } from "vitest/browser";
import { beforeEach, expect, test, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, GeneratedSchedule, SchedulesData } from "@uoplan/core";
import type {
  ImportantDateItem,
  ImportantDatesData,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { noopAnalytics } from "@uoplan/analytics";
import type { AnalyticsClient } from "@uoplan/analytics";

import { CalendarPage } from "./CalendarPage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testCourseCode } from "../../test/brands";
import { AnalyticsContext } from "../../lib/analytics/context";

// ── module boundaries mocked per repo convention (loader + download) ───────
// `useImportantDates` resolves through `@uoplan/data`'s `loadImportantDates`;
// mocking it here (rather than the underlying proto fetch) lets these tests
// drive the hook's loading/error/success states directly while every other
// `@uoplan/data` export stays real. `downloadTextFile` is the browser-download
// boundary (DOM anchor + Blob URL) — mocked exactly like
// `lib/graphPlanner/downloadPlannerIcs.test.ts` mocks it, so real ICS text
// flows through unmodified and is asserted on directly.
const mocks = vi.hoisted(() => ({
  loadImportantDates: vi.fn<(fetchBytes: unknown, locale: string) => Promise<ImportantDatesData>>(),
  downloadTextFile: vi.fn<(filename: string, contents: string, mimeType: string) => void>(),
}));

vi.mock("@uoplan/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@uoplan/data")>();
  return { ...actual, loadImportantDates: mocks.loadImportantDates };
});

vi.mock("../../lib/downloadFile", () => ({
  downloadTextFile: (...args: [string, string, string]) => mocks.downloadTextFile(...args),
}));

function buildRouter() {
  const rootRoute = createRootRoute();
  const scheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/schedule",
    component: () => <div>Schedule</div>,
  });
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
    component: () => <CalendarPage />,
  });
  const routeTree = rootRoute.addChildren([scheduleRoute, calendarRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/calendar"] }),
  });
}

function buildCache() {
  const catalogue: Catalogue = {
    courses: [
      {
        code: testCourseCode("CSI 4900"),
        title: "Honours Project",
        credits: 3,
        description: "",
      },
      {
        code: testCourseCode("CSI 3105"),
        title: "Design and Analysis of Algorithms",
        credits: 3,
        description: "",
      },
    ],
    programs: [],
  };
  const schedules: SchedulesData = { termId: "0000", schedules: [] };
  return buildDataCache(catalogue, schedules);
}

const schedule: GeneratedSchedule = {
  enrollments: [
    {
      courseCode: testCourseCode("CSI 4900"),
      sectionCombo: {},
      times: [],
    },
    {
      courseCode: testCourseCode("CSI 3105"),
      sectionCombo: {},
      times: [{ day: "Mo", startMinutes: 600, endMinutes: 690 }],
    },
  ],
};

test("surfaces scheduled courses that have no calendar time slots in the sidebar", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />, {
    initialState: {
      currentSchedule: schedule,
      cache: buildCache(),
    },
  });

  await page.getByRole("button", { name: "Options" }).click();

  const banner = page.getByTestId("no-timeslot-banner");
  await expect
    .element(banner.getByText("Some courses don't appear on the schedule"))
    .toBeInTheDocument();
  await expect.element(banner.getByText("CSI 4900", { exact: true })).toBeInTheDocument();
  await expect.element(banner.getByText("CSI 3105", { exact: true })).not.toBeInTheDocument();
});

// ── Schedule export dialog integration ──────────────────────────────────────
//
// The calendar's download trigger must open the shared `ScheduleExportDialog`
// instead of downloading immediately. These fixtures deliberately mirror
// `lib/scheduleExport.test.ts`'s scheme exactly (same course/day/time, same
// term interval, same break/deadline dates) so the EXDATE/SUMMARY assertions
// below are proven-exact rather than newly (re)computed.

const EXPORT_TERM_ID = "2261";
const EXPORT_FILENAME = "uoplan-schedule-1-2026-01-12-to-2026-04-15.ics";

/** One Monday 09:00-10:00 lecture, dated so `computeScheduleDateBounds` yields 2026-01-12..2026-04-15. */
function buildExportSchedule(): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode: testCourseCode("CSI 2132"),
        times: [{ day: "Mo", startMinutes: 540, endMinutes: 600 }],
        sectionCombo: {
          LEC: {
            section: {
              section: "A00-LEC",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              times: [
                {
                  day: "Mo",
                  startMinutes: 540,
                  endMinutes: 600,
                  virtual: false,
                  instructor: null,
                  meetingDates: ["2026-01-12", "2026-04-15"],
                },
              ],
              status: null,
            },
          },
        },
      },
    ],
  };
}

function buildExportCache() {
  const catalogue: Catalogue = {
    courses: [
      { code: testCourseCode("CSI 2132"), title: "Formal Methods", credits: 3, description: "" },
    ],
    programs: [],
  };
  const schedules: SchedulesData = { termId: EXPORT_TERM_ID, schedules: [] };
  return buildDataCache(catalogue, schedules);
}

function makeImportantDateItem(
  effect: ImportantDateItem["effect"],
  overrides: Partial<ImportantDateItem> = {},
): ImportantDateItem {
  return { id: "item-1", topic: "Untitled", dateText: "", effect, ...overrides };
}

/** Winter 2026 matching `EXPORT_TERM_ID`: one mandatory break + one optional deadline. */
function makeMatchingImportantDateTerm(termId: string): ImportantDateTerm {
  return {
    sourceId: `source-${termId}`,
    termId,
    label: "Winter 2026",
    season: "winter",
    year: 2026,
    sourcePublished: "true",
    termInterval: { startDate: "2026-01-01", endDate: "2026-04-30" },
    courseInterval: { startDate: "2026-01-12", endDate: "2026-04-13" },
    sessions: [],
    sections: [
      {
        id: "s1",
        label: "Important Dates",
        category: "breaks",
        groups: [
          {
            id: "g1",
            items: [
              makeImportantDateItem("no_classes", {
                id: "family-day",
                topic: "Family Day",
                interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
              }),
              makeImportantDateItem("deadline", {
                id: "add-drop",
                topic: "Add/drop deadline",
                interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
              }),
            ],
          },
        ],
      },
    ],
  };
}

function makeImportantDatesData(terms: ImportantDateTerm[]): ImportantDatesData {
  return { locale: "en", sourceUrl: "https://example.test/important-dates", terms };
}

/** Lets a queued microtask/macrotask queue drain (mirrors ScheduleExportDialog's own test helper). */
function flushAsync(ms = 30) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function buildTestAnalytics(): AnalyticsClient {
  return { ...noopAnalytics, capture: vi.fn() };
}

/**
 * CalendarPage fires an unrelated `schedule_viewed` analytics event whenever a
 * schedule is displayed (see the `viewedScheduleKey` effect) — nothing to do
 * with export. Every assertion here scopes to `schedule_exported` specifically
 * rather than "analytics was called at all".
 */
function scheduleExportedCalls(analytics: AnalyticsClient) {
  const capture = analytics.capture as ReturnType<typeof vi.fn>;
  return capture.mock.calls.filter(([event]) => event === "schedule_exported");
}

async function renderCalendarForExport() {
  const analytics = buildTestAnalytics();
  const rendered = await renderWithProviders(
    <AnalyticsContext.Provider value={analytics}>
      <RouterProvider router={buildRouter()} />
    </AnalyticsContext.Provider>,
    {
      initialState: {
        currentSchedule: buildExportSchedule(),
        cache: buildExportCache(),
        selectedTermId: EXPORT_TERM_ID,
        terms: [{ termId: EXPORT_TERM_ID, name: "Winter 2026" }],
        currentSeed: 1,
      },
    },
  );
  return { ...rendered, analytics };
}

/**
 * This suite's headless viewport renders the calendar's mobile layout (see
 * the existing "surfaces scheduled courses…" test above), where the download
 * trigger lives behind the mobile drawer's "Options" toggle — same button,
 * same `onDownloadIcs` wiring as desktop, just nested one drawer deeper. The
 * mobile drawer (`CalendarMobileDrawer` → Mantine `Drawer`) is ALSO
 * `role="dialog"`, so every export-dialog lookup is named explicitly by its
 * "Export calendar" title to disambiguate from the drawer underneath it.
 */
function exportDialogLocator() {
  return page.getByRole("dialog", { name: /export calendar/i });
}

async function openExportDialog() {
  await page.getByRole("button", { name: "Options" }).click();

  const trigger = page.getByRole("button", { name: "Download ICS" });
  await expect.element(trigger).not.toBeDisabled();
  await trigger.click();
  const dialog = exportDialogLocator();
  await expect.element(dialog).toBeInTheDocument();
  return dialog;
}

type ExportDialogLocator = ReturnType<typeof exportDialogLocator>;

/** Clicks the dialog's Download button and returns the resulting `[filename, ics, mimeType]` once `downloadTextFile` fires. */
async function clickDownloadAndCaptureResult(
  dialog: ExportDialogLocator,
): Promise<[string, string, string]> {
  await dialog.getByRole("button", { name: /download calendar/i }).click();
  await expect.poll(() => mocks.downloadTextFile.mock.calls.length).toBe(1);
  return mocks.downloadTextFile.mock.calls[0] as [string, string, string];
}

/** Clicks the dialog's Download button and asserts the blocked/normalized generic error is shown (dialog stays open). */
async function clickDownloadAndExpectBlocked(dialog: ExportDialogLocator): Promise<void> {
  await dialog.getByRole("button", { name: /download calendar/i }).click();
  await expect.element(dialog.getByRole("alert")).toBeInTheDocument();
  await expect.element(dialog.getByText(/calendar export failed/i)).toBeInTheDocument();
}

beforeEach(() => {
  mocks.loadImportantDates.mockReset();
  mocks.loadImportantDates.mockResolvedValue(
    makeImportantDatesData([makeMatchingImportantDateTerm(EXPORT_TERM_ID)]),
  );
  mocks.downloadTextFile.mockReset();
});

test("clicking the download trigger opens the export dialog without an immediate download or analytics", async () => {
  const { analytics } = await renderCalendarForExport();

  const dialog = await openExportDialog();
  await expect.element(dialog.getByText(/export calendar/i)).toBeInTheDocument();
  await expect.element(dialog.getByText("Winter 2026")).toBeInTheDocument();

  expect(mocks.downloadTextFile).not.toHaveBeenCalled();
  expect(scheduleExportedCalls(analytics)).toHaveLength(0);
});

test("default export (deadlines unchecked) applies the mandatory break, downloads the preserved filename, and closes", async () => {
  await renderCalendarForExport();

  const dialog = await openExportDialog();
  await expect.element(dialog.getByRole("checkbox")).not.toBeChecked();

  const [filename, ics, mimeType] = await clickDownloadAndCaptureResult(dialog);
  expect(filename).toBe(EXPORT_FILENAME);
  expect(mimeType).toBe("text/calendar;charset=utf-8");

  // Proves the real dialog → buildScheduleExport → buildScheduleIcs path ran
  // (not a bypassed/legacy direct builder): the mandatory `no_classes` break
  // always produces an EXDATE plus an all-day marker VEVENT, even though
  // includeDeadlines was left unchecked.
  expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
  expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
  expect(ics).not.toContain("Add/drop deadline");

  await expect.element(exportDialogLocator()).not.toBeInTheDocument();
});

test("checking include-deadlines adds the deadline event to the ICS and fires success analytics exactly once", async () => {
  const { analytics } = await renderCalendarForExport();

  const dialog = await openExportDialog();
  await dialog.getByRole("checkbox").click();
  await expect.element(dialog.getByRole("checkbox")).toBeChecked();

  const [, ics] = await clickDownloadAndCaptureResult(dialog);
  expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
  expect(ics).toContain("SUMMARY:Add/drop deadline\r\n");

  expect(scheduleExportedCalls(analytics)).toEqual([["schedule_exported", { target: "ics" }]]);
});

test("important-date data still loading blocks download with a localized error and leaves the dialog open", async () => {
  mocks.loadImportantDates.mockImplementation(() => new Promise(() => {}));

  const { analytics } = await renderCalendarForExport();
  const dialog = await openExportDialog();

  await clickDownloadAndExpectBlocked(dialog);
  await expect.element(exportDialogLocator()).toBeInTheDocument();

  expect(mocks.downloadTextFile).not.toHaveBeenCalled();
  expect(scheduleExportedCalls(analytics)).toHaveLength(0);
});

test("a failed important-date load blocks download with a localized error, and retry lets a later click succeed", async () => {
  mocks.loadImportantDates
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(makeImportantDatesData([makeMatchingImportantDateTerm(EXPORT_TERM_ID)]));

  await renderCalendarForExport();

  // Let the initial (failing) load settle before interacting, so the first
  // click deterministically observes the hook's error state, not its loading
  // state (which would also block, but wouldn't yet have retried).
  await expect.poll(() => mocks.loadImportantDates.mock.calls.length).toBeGreaterThanOrEqual(1);
  await flushAsync(50);

  const dialog = await openExportDialog();
  await clickDownloadAndExpectBlocked(dialog);
  expect(mocks.downloadTextFile).not.toHaveBeenCalled();

  // The blocked click must have triggered a stable retry (not a retry loop):
  // exactly one extra load attempt so far.
  await expect.poll(() => mocks.loadImportantDates.mock.calls.length).toBe(2);

  // Let the retried (resolved) load settle, then a later click succeeds.
  await flushAsync(60);
  await clickDownloadAndCaptureResult(dialog);
  await expect.element(exportDialogLocator()).not.toBeInTheDocument();
});

test("a resolved important-dates dataset without a matching term is normalized to the generic error, with no download/analytics/close", async () => {
  mocks.loadImportantDates.mockResolvedValue(makeImportantDatesData([]));

  const { analytics } = await renderCalendarForExport();
  const dialog = await openExportDialog();

  await clickDownloadAndExpectBlocked(dialog);
  // The raw domain error must never reach the user.
  await expect.element(dialog.getByText(/no important-date term matches/i)).not.toBeInTheDocument();

  expect(mocks.downloadTextFile).not.toHaveBeenCalled();
  expect(scheduleExportedCalls(analytics)).toHaveLength(0);
  await expect.element(exportDialogLocator()).toBeInTheDocument();
});

test("a downloadTextFile (browser download boundary) failure is normalized, not surfaced raw, and blocks analytics/close", async () => {
  const rawMessage = "RAW_DOWNLOAD_BOUNDARY_FAILURE_xyz123";
  mocks.downloadTextFile.mockImplementationOnce(() => {
    throw new Error(rawMessage);
  });

  const { analytics } = await renderCalendarForExport();
  const dialog = await openExportDialog();

  await clickDownloadAndExpectBlocked(dialog);
  // The raw technical download-boundary error must never reach the user.
  await expect.element(dialog.getByText(rawMessage)).not.toBeInTheDocument();

  // buildScheduleExport succeeded and reached downloadTextFile exactly once —
  // only the browser-download boundary failed, and only once (no retry loop,
  // no accidental double-invocation).
  expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
  expect(scheduleExportedCalls(analytics)).toHaveLength(0);
  await expect.element(exportDialogLocator()).toBeInTheDocument();
});

test("cancel closes the dialog without downloading or firing analytics", async () => {
  const { analytics } = await renderCalendarForExport();
  const dialog = await openExportDialog();

  await dialog.getByRole("button", { name: /cancel/i }).click();

  await expect.element(exportDialogLocator()).not.toBeInTheDocument();
  expect(mocks.downloadTextFile).not.toHaveBeenCalled();
  expect(scheduleExportedCalls(analytics)).toHaveLength(0);
});

test("changing the live schedule while the dialog stays open still exports the snapshot taken at open time", async () => {
  const { store } = await renderCalendarForExport();
  const dialog = await openExportDialog();

  // Simulate a background schedule change (e.g. seed navigation) while the
  // dialog remains open — the export must keep using what the user actually
  // opened the dialog for, not the newer live state.
  store.setState({ currentSeed: 99 });

  const [filename] = await clickDownloadAndCaptureResult(dialog);
  expect(filename).toBe(EXPORT_FILENAME);
});
