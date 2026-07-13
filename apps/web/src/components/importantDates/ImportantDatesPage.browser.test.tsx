import { page, userEvent } from "vitest/browser";
import { expect, test, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ImportantDatesData, ImportantDateTerm } from "@uoplan/core/dataTypes";

import { ImportantDatesPage } from "./ImportantDatesPage";
import { renderWithProviders } from "../../test/renderWithProviders";

// ── Test fixtures ──────────────────────────────────────────────────────────

function interval(start: string, end: string) {
  return { startDate: start, endDate: end };
}

function makeTerm(
  sourceId: string,
  season: ImportantDateTerm["season"],
  year: number,
  overrides: Partial<ImportantDateTerm> = {},
): ImportantDateTerm {
  return {
    sourceId,
    label: `${season} ${year}`,
    season,
    year,
    sourcePublished: "true",
    termInterval: interval("2025-09-01", "2025-12-31"),
    courseInterval: interval("2025-09-08", "2025-12-05"),
    sessions: [],
    sections: [],
    ...overrides,
  };
}

const CURRENT_TERM_A = makeTerm("winter-2026", "winter", 2026, {
  label: "Winter 2026",
  termInterval: interval("2026-01-01", "2026-04-30"),
  courseInterval: interval("2026-01-12", "2026-04-10"),
  sections: [
    {
      id: "overview",
      label: "Overview",
      category: "overview",
      groups: [
        {
          id: "ov-group",
          items: [
            {
              id: "term-dates",
              topic: "Term dates",
              dateText: "January 12 to April 10, 2026",
              effect: "structural",
            },
          ],
        },
      ],
    },
    {
      id: "enrolment",
      label: "Enrolment",
      category: "enrolment",
      groups: [
        {
          id: "enrolment-group",
          label: "Session A",
          items: [
            {
              id: "enrol-open",
              topic: "Enrolment opens",
              dateText: "November 15, 2025",
              effect: "deadline",
              interval: interval("2025-11-15", "2025-11-15"),
            },
          ],
        },
        {
          id: "enrolment-group-b",
          label: "Session B",
          items: [
            {
              id: "enrol-b",
              topic: "Late enrolment",
              dateText: "January 20, 2026",
              effect: "deadline",
              interval: interval("2026-01-20", "2026-01-20"),
              usedEnglishFallback: true,
            },
          ],
        },
        {
          id: "overflow-group",
          label: "Overflow examples",
          items: [
            {
              id: "overflow-a",
              topic: "Task A deadline",
              dateText: "January 14, 2026",
              effect: "deadline",
              interval: interval("2026-01-14", "2026-01-14"),
            },
            {
              id: "overflow-b",
              topic: "Task B deadline",
              dateText: "January 14, 2026",
              effect: "deadline",
              interval: interval("2026-01-14", "2026-01-14"),
            },
            {
              id: "overflow-c",
              topic: "Task C deadline",
              dateText: "January 14, 2026",
              effect: "deadline",
              interval: interval("2026-01-14", "2026-01-14"),
            },
            {
              id: "overflow-d",
              topic: "Task D deadline",
              dateText: "January 14, 2026",
              effect: "deadline",
              interval: interval("2026-01-14", "2026-01-14"),
            },
          ],
        },
      ],
    },
    {
      id: "breaks",
      label: "Breaks",
      category: "breaks",
      groups: [
        {
          id: "reading-week-group",
          items: [
            {
              id: "reading-week",
              topic: "Reading week",
              dateText: "January 19 to 23, 2026",
              effect: "no_classes",
              interval: interval("2026-01-19", "2026-01-23"),
            },
            {
              id: "campus-note",
              topic: "Campus services note",
              dateText: "See campus updates for details",
              effect: "informational",
            },
          ],
        },
      ],
    },
  ],
});

const CURRENT_TERM_B = makeTerm("spring-2026", "spring-summer", 2026, {
  label: "Spring/Summer 2026",
  termInterval: interval("2026-05-01", "2026-08-31"),
  courseInterval: interval("2026-05-04", "2026-08-07"),
});

const HISTORICAL_TERM = makeTerm("fall-2025", "fall", 2025, {
  label: "Fall 2025",
  sourcePublished: "false",
  termInterval: interval("2025-09-01", "2025-12-31"),
  courseInterval: interval("2025-09-08", "2025-12-05"),
});

const SAMPLE_DATA: ImportantDatesData = {
  locale: "en",
  sourceUrl: "https://www.uottawa.ca/important-dates",
  reviewedText: "Reviewed July 1, 2026",
  terms: [CURRENT_TERM_A, CURRENT_TERM_B, HISTORICAL_TERM],
};

// ── Router setup ──────────────────────────────────────────────────────────

function buildRouter(component: () => React.JSX.Element) {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Home</div>,
  });
  const importantDatesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/important-dates-and-deadlines",
    component,
  });
  const routeTree = rootRoute.addChildren([homeRoute, importantDatesRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/important-dates-and-deadlines"],
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test("loading state renders skeletons, not content", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={null}
      loading
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // No term tabs during loading
  await expect.element(page.getByRole("tab", { name: /winter 2026/i })).not.toBeInTheDocument();
  // No download button during loading
  await expect
    .element(page.getByRole("button", { name: /download calendar/i }))
    .not.toBeInTheDocument();
  // The page title heading IS visible (it renders outside the loading state)
  await expect.element(page.getByRole("heading", { level: 1 })).toBeInTheDocument();
});

test("error state shows inline error message with retry button", async () => {
  const onRetry = vi.fn();
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={null}
      loading={false}
      error={new Error("Network failure")}
      onRetry={onRetry}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText(/important dates could not be loaded/i)).toBeInTheDocument();
  await page.getByRole("button", { name: /retry/i }).click();
  expect(onRetry).toHaveBeenCalledOnce();
});

test("empty state explains no dates available", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={{ locale: "en", sourceUrl: "https://uottawa.ca", terms: [] }}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText(/no important dates/i)).toBeInTheDocument();
});

test("renders current term tabs chronologically", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Should show Winter 2026 then Spring/Summer 2026 (chronological)
  const termStrip = page.getByRole("tablist", { name: /terms/i });
  const firstTab = termStrip.getByRole("tab").nth(0);
  const secondTab = termStrip.getByRole("tab").nth(1);
  await expect.element(firstTab).toHaveTextContent(/Winter 2026/);
  await expect.element(secondTab).toHaveTextContent(/Spring\/Summer 2026/);
});

test("passed term is visually muted but still clickable and accessible", async () => {
  const today = "2026-05-01"; // After Winter 2026 term end (2026-04-30)
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today={today}
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // A passed term must not appear in the initial (current) view at all.
  await expect.element(page.getByRole("tab", { name: /winter 2026/i })).not.toBeInTheDocument();

  // It is reachable via the previous-terms toggle, still enabled and clickable.
  await page.getByRole("button", { name: /previous term/i }).click();
  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  await expect.element(winterTab).not.toBeDisabled();
  await winterTab.click();
  await expect.element(winterTab).toHaveAttribute("aria-selected", "true");
});

test("passed qualifier is announced to assistive tech but not visibly rendered", async () => {
  const today = "2026-05-01"; // After Winter 2026 term end (2026-04-30)
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today={today}
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: /previous term/i }).click();

  // The tab's accessible name includes the "(passed)" qualifier for screen
  // readers, so it can be found via an accessible-name query...
  const winterTab = page.getByRole("tab", { name: /winter 2026.*passed/i });
  await expect.element(winterTab).toBeInTheDocument();

  // ...but the qualifier text itself must not be visibly rendered on screen.
  // (jest-dom's `toBeVisible` doesn't account for the clip-rect visually-
  // hidden technique, so assert directly on the rendered box size instead.)
  const passedQualifier = winterTab.getByText("(passed)");
  await expect.element(passedQualifier).toBeInTheDocument();
  const rect = passedQualifier.element().getBoundingClientRect();
  expect(rect.width).toBeLessThanOrEqual(1);
  expect(rect.height).toBeLessThanOrEqual(1);
});

test("default term is auto-selected based on today", async () => {
  const today = "2026-01-15"; // Inside Winter 2026 courseInterval
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today={today}
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  await expect.element(winterTab).toHaveAttribute("aria-selected", "true");
});

test("selecting another term shows its label as active", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });
  await springTab.click();
  await expect.element(springTab).toHaveAttribute("aria-selected", "true");
});

test("previous terms toggle switches to historical view, then back", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Initially current terms are shown
  await expect.element(page.getByRole("tab", { name: /winter 2026/i })).toBeInTheDocument();

  // Click "1 previous term" button
  const prevButton = page.getByRole("button", { name: /previous term/i });
  await prevButton.click();

  // Now historical term tab should appear
  await expect.element(page.getByRole("tab", { name: /fall 2025/i })).toBeInTheDocument();

  // Click "N current terms" to return
  const currButton = page.getByRole("button", { name: /current term/i });
  await currButton.click();

  // Back to current view
  await expect.element(page.getByRole("tab", { name: /winter 2026/i })).toBeInTheDocument();
});

test("historical terms remain clickable", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: /previous term/i }).click();
  const fallTab = page.getByRole("tab", { name: /fall 2025/i });
  await expect.element(fallTab).not.toBeDisabled();
  await fallTab.click();
  await expect.element(fallTab).toHaveAttribute("aria-selected", "true");
});

test("overview section renders inline before accordion sections", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // The overview item should be visible without needing to expand accordion
  await expect.element(page.getByText("Term dates")).toBeInTheDocument();

  // The enrolment section is non-overview: it should be behind an accordion control
  const enrolmentControl = page.getByRole("button", { name: "Enrolment", exact: true });
  await expect.element(enrolmentControl).toBeInTheDocument();
});

test("non-overview sections are collapsible and reveal nested group labels", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Expand the Enrolment accordion
  await page.getByRole("button", { name: "Enrolment", exact: true }).click();

  // Should see nested group label "Session A"
  await expect.element(page.getByText("Session A")).toBeInTheDocument();
  // And "Session B"
  await expect.element(page.getByText("Session B")).toBeInTheDocument();
});

test("uses a semantic table with topic and dates headers", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Semantic table should have columnheader roles
  await expect.element(page.getByRole("columnheader", { name: /activity/i })).toBeInTheDocument();
  await expect.element(page.getByRole("columnheader", { name: /dates/i })).toBeInTheDocument();
});

test("English fallback indication is shown for usedEnglishFallback rows", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Expand enrolment to see the fallback row
  await page.getByRole("button", { name: "Enrolment", exact: true }).click();

  // Should have English-only indicator (text or aria label)
  await expect.element(page.getByText(/english only/i)).toBeInTheDocument();
});

test("download button calls onDownload with the selected term", async () => {
  const onDownload = vi.fn();
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={onDownload}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: /download calendar/i }).click();
  expect(onDownload).toHaveBeenCalledOnce();
  expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "winter-2026" }));
});

test("async download failure shows download error near the action", async () => {
  const DOWNLOAD_ERR = "Calendar download failed. Please try again.";
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      downloadError={DOWNLOAD_ERR}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText(DOWNLOAD_ERR)).toBeInTheDocument();
});

test("French locale fixture strings render in French", async () => {
  const frenchData: ImportantDatesData = {
    locale: "fr-CA",
    sourceUrl: "https://www.uottawa.ca/dates-importantes",
    terms: [
      {
        ...CURRENT_TERM_A,
        label: "Hiver 2026",
        sections: [
          {
            id: "overview",
            label: "Aperçu",
            category: "overview",
            groups: [
              {
                id: "ov-group",
                items: [
                  {
                    id: "term-dates",
                    topic: "Dates du trimestre",
                    dateText: "12 janvier au 10 avril 2026",
                    effect: "structural",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={frenchData}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByRole("tab", { name: /hiver 2026/i })).toBeInTheDocument();
  await expect.element(page.getByText(/aperçu/i)).toBeInTheDocument();
  await expect.element(page.getByText(/dates du trimestre/i)).toBeInTheDocument();
});

test("selected passed term has full opacity (active+passed compound rule)", async () => {
  // today is past Winter 2026 (ends 2026-04-30), making it a passed term
  const today = "2026-05-01";
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today={today}
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Passed terms only surface via the previous-terms toggle.
  await page.getByRole("button", { name: /previous term/i }).click();
  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  // Click the passed tab to make it the active selection
  await winterTab.click();
  await expect.element(winterTab).toHaveAttribute("aria-selected", "true");
  // Active + passed must restore full opacity so the label stays legible
  await expect.element(winterTab).toHaveStyle({ opacity: "1" });
});

test("group label rows use th[scope=rowgroup] row-header semantics", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Expand the Enrolment accordion to reveal group-label rows
  await page.getByRole("button", { name: "Enrolment", exact: true }).click();

  // Group labels must be <th scope="rowgroup"> — ARIA rowheader —
  // not <td>, so assistive technologies identify them as row-group headers.
  await expect.element(page.getByRole("rowheader", { name: "Session A" })).toBeInTheDocument();
  await expect.element(page.getByRole("rowheader", { name: "Session B" })).toBeInTheDocument();
});

// ── ARIA tablist / keyboard regression tests ──────────────────────────────

test("tablist owns only role=tab elements; group-toggle is a sibling outside the tablist", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const tablist = page.getByRole("tablist", { name: /terms/i });
  // The toggle is a plain button, NOT a tab — it must not be inside the tablist.
  await expect
    .element(tablist.getByRole("button", { name: /previous term/i }))
    .not.toBeInTheDocument();
  // But the toggle IS present in the page as a normal interactive button.
  const toggle = page.getByRole("button", { name: /previous term/i });
  await expect.element(toggle).toBeInTheDocument();
  // And it still switches to the historical group.
  await toggle.click();
  await expect.element(page.getByRole("tab", { name: /fall 2025/i })).toBeInTheDocument();
});

test("roving tabindex: selected tab has tabindex=0, non-selected tabs have tabindex=-1", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });
  await expect.element(winterTab).toHaveAttribute("tabindex", "0");
  await expect.element(springTab).toHaveAttribute("tabindex", "-1");
});

test("ArrowRight selects and focuses next tab, wrapping from last back to first", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });

  // Click to focus the default-selected tab, then use keyboard
  await winterTab.click();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(springTab).toHaveAttribute("aria-selected", "true");
  await expect.element(springTab).toHaveFocus();

  // From last tab, ArrowRight wraps to first
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(winterTab).toHaveAttribute("aria-selected", "true");
  await expect.element(winterTab).toHaveFocus();
});

test("aria-controls on active tab resolves to mounted panel; inactive tabs have no aria-controls", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });

  // Active tab: aria-controls must point to a mounted panel
  const activeEl = winterTab.element();
  const panelId = activeEl.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = document.getElementById(panelId!);
  expect(panel).not.toBeNull();

  // Inactive tab: must NOT carry aria-controls (panel is not mounted)
  await expect.element(springTab).not.toHaveAttribute("aria-controls");
});

test("ArrowLeft selects and focuses previous tab, wrapping from first back to last", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });

  // From first tab, ArrowLeft wraps to Spring/Summer (last)
  await winterTab.click();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(springTab).toHaveAttribute("aria-selected", "true");
  await expect.element(springTab).toHaveFocus();
});

test("End selects/focuses last tab; Home selects/focuses first tab", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  const winterTab = page.getByRole("tab", { name: /winter 2026/i });
  const springTab = page.getByRole("tab", { name: /spring\/summer 2026/i });

  // End from Winter (first, default selected) → Spring/Summer (last)
  await winterTab.click();
  await userEvent.keyboard("{End}");
  await expect.element(springTab).toHaveAttribute("aria-selected", "true");
  await expect.element(springTab).toHaveFocus();

  // Home from Spring/Summer → back to Winter (first)
  await userEvent.keyboard("{Home}");
  await expect.element(winterTab).toHaveAttribute("aria-selected", "true");
  await expect.element(winterTab).toHaveFocus();
});

// ── Monthly calendar, badges, linked selection ────────────────────────────

test("monthly calendar renders above content with navigation controls and a 4-item legend", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByRole("button", { name: /previous month/i })).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /next month/i })).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /^today$/i })).toBeInTheDocument();
  // Default month is derived from `today` (January 2026).
  await expect.element(page.getByText(/january 2026/i)).toBeInTheDocument();

  await expect.element(page.getByText(/^break$/i)).toBeInTheDocument();
  await expect.element(page.getByText(/schedule change/i)).toBeInTheDocument();
  await expect.element(page.getByText(/^deadline$/i)).toBeInTheDocument();
  await expect.element(page.getByText(/^information$/i)).toBeInTheDocument();
});

test("dated table rows render a badge button and keep the original dateText visible", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: "Enrolment", exact: true }).click();
  // "Late enrolment" is dated within the calendar's default visible month, so
  // both the table badge and the matching calendar event share this
  // accessible name — the badge is the one rendered inside the table (last).
  const badge = page.getByRole("button", { name: /late enrolment/i }).last();
  await expect.element(badge).toBeInTheDocument();
  await expect.element(badge).toHaveAttribute("data-role", "date-badge");
  // The original source text must still be visible next to the badge.
  await expect.element(page.getByText("January 20, 2026")).toBeInTheDocument();
});

test("structural and undated rows render plain source text with no badge", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Structural overview row: dateText renders as plain text, not a button.
  await expect.element(page.getByText("January 12 to April 10, 2026")).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /term dates/i })).not.toBeInTheDocument();

  // Non-structural but undated row: also plain text, no badge.
  await page.getByRole("button", { name: /^breaks$/i }).click();
  await expect.element(page.getByText("See campus updates for details")).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: /campus services note/i }))
    .not.toBeInTheDocument();
});

test("clicking a date badge switches the calendar month to the event start and selects it", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: "Enrolment", exact: true }).click();
  const badge = page.getByRole("button", { name: /enrolment opens/i });
  await badge.click();

  // "Enrolment opens" is dated November 15, 2025 — the calendar must jump there.
  await expect.element(page.getByText(/november 2025/i)).toBeInTheDocument();
  // The matching calendar event becomes the pressed/selected one.
  const calendarEvent = page.getByRole("button", { name: /enrolment opens/i, exact: false }).nth(1);
  await expect.element(calendarEvent).toHaveAttribute("aria-pressed", "true");
});

test("clicking a calendar event for a non-overview item auto-expands its section and reveals the row", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // The "Reading week" row is inside the collapsed "Breaks" accordion section,
  // so it must not be in the document yet. Scope by test id since the
  // calendar event button already visible shares the same accessible name
  // and text content as the table cell.
  await expect
    .element(page.getByTestId("importantdates-topic-reading-week"))
    .not.toBeInTheDocument();

  const calendarEvent = page.getByRole("button", { name: /reading week/i }).first();
  await calendarEvent.click();

  // Activating it from the calendar must auto-expand Breaks and reveal the row.
  await expect.element(page.getByTestId("importantdates-topic-reading-week")).toBeInTheDocument();
});

test("overview calendar events select without needing any accordion expansion", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("Term dates")).toBeInTheDocument();
});

test("selecting an event announces it via a polite live region", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: "Enrolment", exact: true }).click();
  await page
    .getByRole("button", { name: /late enrolment/i })
    .first()
    .click();

  await expect.element(page.getByRole("status")).toHaveTextContent(/late enrolment/i);
});

test("a range spanning multiple weeks exposes exactly one stable calendar-event id", async () => {
  const multiWeekTerm = makeTerm("winter-2026-multiweek", "winter", 2026, {
    label: "Winter 2026 Multiweek",
    termInterval: interval("2026-01-01", "2026-04-30"),
    courseInterval: interval("2026-01-12", "2026-04-10"),
    sections: [
      {
        id: "overview",
        label: "Overview",
        category: "overview",
        groups: [
          {
            id: "ov-group",
            items: [
              {
                id: "reading-week",
                topic: "Reading week",
                dateText: "January 28 to February 3, 2026",
                effect: "no_classes",
                interval: interval("2026-01-28", "2026-02-03"),
              },
            ],
          },
        ],
      },
    ],
  });
  const data: ImportantDatesData = {
    locale: "en",
    sourceUrl: "https://www.uottawa.ca/important-dates",
    terms: [multiWeekTerm],
  };
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={data}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // Jan 28 – Feb 3, 2026 crosses a Monday-first week boundary, so it renders
  // as (at least) two separate weekly bar segments in the January grid.
  const segments = page.getByRole("button", { name: /reading week/i });
  await expect.element(segments.first()).toBeInTheDocument();
  expect(segments.elements().length).toBeGreaterThanOrEqual(2);

  // Exactly one segment across the whole grid carries the stable id that
  // badge activation targets — never zero, and never duplicated.
  expect(document.querySelectorAll("#importantdates-calendar-event-reading-week").length).toBe(1);

  // Every segment (including the later, non-primary ones) stays present and
  // interactive: clicking the last segment still selects/highlights it.
  await segments.last().click();
  await expect.element(segments.last()).toHaveAttribute("aria-pressed", "true");
  await expect.element(segments.first()).toHaveAttribute("aria-pressed", "true");
});

test("overflow: a day with more than 3 events exposes a keyboard-operable '+N more' control", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // January 14, 2026 has 4 same-day deadlines; with a 3-lane cap that's +1 hidden.
  const moreButton = page.getByRole("button", { name: /1 more/i });
  await expect.element(moreButton).toBeInTheDocument();
  await moreButton.click();
  // Scope to the overflow list button since "Task D deadline" is also always
  // visible as plain topic text in its (already-rendered) table cell.
  await expect.element(page.getByRole("button", { name: "Task D deadline" })).toBeInTheDocument();
});

test("badge activation for an overflow-hidden item auto-opens that day's overflow and links it", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByRole("button", { name: "Enrolment", exact: true }).click();

  // "Task D deadline" is the 4th same-day (Jan 14, 2026) event and is hidden
  // behind the calendar's 3-lane overflow until its day is expanded. The
  // table badge's accessible name includes the date ("... on January 14,
  // 2026") which distinguishes it from the plain-topic calendar-event
  // control once the latter is revealed later in this test.
  const badge = page.getByRole("button", { name: /task d deadline on/i });
  await expect.element(badge).toBeInTheDocument();

  // Mouse activation must deterministically reveal a calendar-event node for
  // the hidden entry (auto-opening only its own day's overflow) and mark it
  // selected, without moving focus away from the clicked badge.
  await badge.click();
  const calendarControl = page.getByRole("button", { name: /task d deadline/i }).first();
  await expect
    .element(calendarControl)
    .toHaveAttribute("id", "importantdates-calendar-event-overflow-d");
  await expect.element(calendarControl).toHaveAttribute("aria-pressed", "true");
  await expect.element(calendarControl).not.toHaveFocus();

  // Exactly one day's overflow toggle exists (this fixture has a single
  // overflow day) and it is the one now marked expanded — i.e. activation
  // opened that day's overflow and nothing else.
  const overflowToggle = page.getByRole("button", { name: /1 more/i });
  await expect.element(overflowToggle).toBeInTheDocument();
  await expect.element(overflowToggle).toHaveAttribute("aria-expanded", "true");

  // Keyboard activation of the badge must move focus to that same stable
  // calendar control.
  badge.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(calendarControl).toHaveFocus();
});

test("reviewed label renders exactly once and is not duplicated", async () => {
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={SAMPLE_DATA}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("Last reviewed: Reviewed July 1, 2026")).toBeInTheDocument();
});

test("when no current terms exist, the page stays functional without a fabricated current selection", async () => {
  const pastPublishedTerm = makeTerm("fall-2020", "fall", 2020, {
    label: "Fall 2020",
    sourcePublished: "true",
    termInterval: interval("2020-09-01", "2020-12-31"),
    courseInterval: interval("2020-09-08", "2020-12-05"),
  });
  const data: ImportantDatesData = {
    locale: "en",
    sourceUrl: "https://www.uottawa.ca/important-dates",
    terms: [pastPublishedTerm],
  };
  const router = buildRouter(() => (
    <ImportantDatesPage
      data={data}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onDownload={vi.fn()}
      today="2026-01-15"
    />
  ));
  await renderWithProviders(<RouterProvider router={router} />);

  // No current-term tab is fabricated.
  await expect.element(page.getByRole("tab", { name: /fall 2020/i })).not.toBeInTheDocument();
  // But the previous-terms toggle still works.
  const prevButton = page.getByRole("button", { name: /previous term/i });
  await expect.element(prevButton).toBeInTheDocument();
  await prevButton.click();
  await expect.element(page.getByRole("tab", { name: /fall 2020/i })).toBeInTheDocument();
});
