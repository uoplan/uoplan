import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ImportantDatesData, ImportantDateTerm } from "@uoplan/core/dataTypes";
import { usePlannerScheduleExport } from "../../lib/graphPlanner/usePlannerScheduleExport";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import { formatTermLabel } from "../../lib/term/termLabel";
import { renderWithProviders } from "../../test/renderWithProviders";
import { realGraphPlannerBundle as realBundle } from "../../test/scheduleExportFixtures";
import { ScheduleExportDialog } from "../calendar/ScheduleExportDialog";
import { PlannerActionsProvider } from "./plannerActionsContext";
import type { PlannerActions } from "./plannerActionsContext";
import { PlannerSidebar } from "./PlannerSidebar";
import type { PlannerSidebarProps } from "./PlannerSidebar";
import { PlannerTermControls } from "./PlannerTermControls";

/**
 * Integration coverage for *where the dialog lives*: a single
 * `usePlannerScheduleExport` instance backing exactly one `ScheduleExportDialog`,
 * reached only through the same `PlannerActions.downloadTerm` /
 * `downloadAllTerms` contract that `PlannerTermControls` / `PlannerSidebar`
 * already call (both files are unmodified by this change — this test proves
 * their existing `onClick={() => actions.downloadTerm(termId)}` wiring now
 * opens the dialog instead of downloading immediately).
 *
 * `DegreePlannerPage` additionally owns the React Flow graph canvas
 * (`useGraphPlanner`, `buildPlannerGraph`, node layout, …), which this change
 * does not touch, so this harness reproduces only the export-dialog ownership
 * wiring — including mounting `PlannerSidebar` twice, exactly like
 * `DegreePlannerPage` does for its desktop/mobile layouts — without pulling in
 * that unrelated weight.
 */

const mocks = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
  capture: vi.fn(),
  useImportantDates: vi.fn(),
}));

vi.mock("../../lib/downloadFile", () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

vi.mock("../../lib/analytics", () => ({
  useAnalytics: () => ({ capture: mocks.capture }),
}));

vi.mock("../../hooks/useImportantDates", () => ({
  useImportantDates: mocks.useImportantDates,
}));

function importantDateTerm(
  termId: string,
  season: ImportantDateTerm["season"],
  year: number,
): ImportantDateTerm {
  return {
    sourceId: `source-${termId}`,
    termId,
    label: `${season} ${year}`,
    season,
    year,
    sourcePublished: "true",
    termInterval: { startDate: "2025-01-01", endDate: "2026-12-31" },
    courseInterval: { startDate: "2025-01-01", endDate: "2026-12-31" },
    sessions: [],
    sections: [],
  };
}

/** Real, matching important-dates fixture for both terms used across this file's tests. */
function importantDatesFixture(): ImportantDatesData {
  return {
    locale: "en",
    sourceUrl: "https://example.test/dates",
    terms: [importantDateTerm("2259", "fall", 2025), importantDateTerm("2261", "winter", 2026)],
  };
}

const sidebarProps: PlannerSidebarProps = {
  hasProgram: true,
  hasTranscript: true,
  isGenerating: false,
  hasEnabledTerms: true,
  defaultCount: 5,
  onDefaultCountChange: () => {},
  onRegenerateAll: () => {},
  onClearPlan: () => {},
  onResetLayout: () => {},
  onPersonalize: () => {},
};

/** `PlannerSidebar` renders a `BackButton`, which needs a router in the tree. */
function buildRouter(termIds: string[], mountSidebarTwice: boolean) {
  const rootRoute = createRootRoute();
  const graphRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/graph",
    component: () => <Harness termIds={termIds} mountSidebarTwice={mountSidebarTwice} />,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([graphRoute]),
    history: createMemoryHistory({ initialEntries: ["/graph"] }),
  });
}

function Harness({
  termIds,
  mountSidebarTwice = false,
}: {
  termIds: string[];
  mountSidebarTwice?: boolean;
}) {
  const scheduleExport = usePlannerScheduleExport(null);

  const downloadTerm = (termId: string) => {
    const bundle = useGraphPlannerStore.getState().resultByTermId[termId];
    scheduleExport.openTermExport({ termId, label: formatTermLabel(termId), bundle });
  };

  const downloadAllTerms = () => {
    const pstate = useGraphPlannerStore.getState();
    const terms = pstate.enabledTermIds.map((termId) => ({
      termId,
      label: formatTermLabel(termId),
      bundle: pstate.resultByTermId[termId],
    }));
    scheduleExport.openAllTermsExport(terms);
  };

  const actions: PlannerActions = {
    hasProgram: true,
    isGenerating: false,
    runningTermId: null,
    selectedTermId: null,
    enableTerm: () => {},
    disableTerm: () => {},
    changeCount: () => {},
    regenerateTerm: () => {},
    previousTerm: () => {},
    openInCalendar: () => {},
    selectTerm: () => {},
    downloadTerm,
    downloadAllTerms,
    goToPersonalize: () => {},
  };

  return (
    <PlannerActionsProvider value={actions}>
      {termIds.map((termId) => (
        <PlannerTermControls key={termId} termId={termId} />
      ))}
      <PlannerSidebar {...sidebarProps} />
      {mountSidebarTwice ? <PlannerSidebar {...sidebarProps} /> : null}
      <ScheduleExportDialog
        opened={scheduleExport.request !== null}
        onClose={scheduleExport.close}
        onExport={scheduleExport.onExport}
        scopeLabel={scheduleExport.scopeLabel}
      />
    </PlannerActionsProvider>
  );
}

describe("graph planner schedule export dialog ownership", () => {
  beforeEach(() => {
    mocks.downloadTextFile.mockReset();
    mocks.capture.mockReset();
    mocks.useImportantDates.mockReset();
    mocks.useImportantDates.mockReturnValue({
      data: importantDatesFixture(),
      loading: false,
      error: null,
      retry: vi.fn(),
    });

    useGraphPlannerStore.getState().resetPlanner();
    useGraphPlannerStore.setState({
      enabledTermIds: ["2259", "2261"],
      resultByTermId: {
        "2259": realBundle(["2025-09-03", "2025-12-05"]),
        "2261": realBundle(["2026-01-12", "2026-04-15"]),
      },
    });
  });

  afterEach(() => {
    useGraphPlannerStore.getState().resetPlanner();
  });

  test("clicking a single term's download button opens the dialog and performs no immediate download", async () => {
    await renderWithProviders(<RouterProvider router={buildRouter(["2261"], false)} />);

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Download this term" }).click();

    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    // Scoped to the dialog: the sidebar's own term tab also renders "Winter 2026".
    await expect.element(page.getByRole("dialog").getByText("Winter 2026")).toBeInTheDocument();
    expect(mocks.downloadTextFile).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  test("clicking the download-all button opens the very same dialog and performs no immediate download", async () => {
    await renderWithProviders(<RouterProvider router={buildRouter(["2261"], false)} />);

    await page.getByRole("button", { name: "Download all terms" }).click();

    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    // "All terms" scope carries no single-term scope label inside the dialog
    // (the sidebar's own term tab still renders "Winter 2026" outside it).
    await expect.element(page.getByRole("dialog").getByText("Winter 2026")).not.toBeInTheDocument();
    expect(mocks.downloadTextFile).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  test("only one dialog instance ever exists, even with multiple terms and a duplicated sidebar mount", async () => {
    await renderWithProviders(<RouterProvider router={buildRouter(["2259", "2261"], true)} />);

    // Two terms => two "Download this term" buttons; two sidebar mounts => two
    // "Download all terms" buttons. Exactly one dialog must exist regardless.
    expect(page.getByRole("button", { name: "Download this term" }).elements()).toHaveLength(2);
    expect(page.getByRole("button", { name: "Download all terms" }).elements()).toHaveLength(2);
    expect(page.getByRole("dialog").elements()).toHaveLength(0);

    await page.getByRole("button", { name: "Download this term" }).nth(0).click();

    expect(page.getByRole("dialog").elements()).toHaveLength(1);
  });

  test("a term with no dated schedule keeps its download button disabled (unchanged canDownloadTerm behavior)", async () => {
    useGraphPlannerStore.setState({ enabledTermIds: ["2261"], resultByTermId: {} });

    await renderWithProviders(<RouterProvider router={buildRouter(["2261"], false)} />);

    await expect.element(page.getByRole("button", { name: "Download this term" })).toBeDisabled();

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  test("confirming the dialog downloads once, fires analytics once, and closes — end to end through the real dialog UI", async () => {
    await renderWithProviders(<RouterProvider router={buildRouter(["2261"], false)} />);

    await page.getByRole("button", { name: "Download this term" }).click();
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();

    await page.getByRole("button", { name: /download calendar/i }).click();

    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.downloadTextFile).toHaveBeenCalledOnce();
    const [filename, ics, mimeType] = mocks.downloadTextFile.mock.calls[0];
    expect(filename).toBe("uoplan-winter-2026-2026-01-12-to-2026-04-15.ics");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(mimeType).toBe("text/calendar;charset=utf-8");
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("schedule_exported", { target: "ics" });
  });
});
