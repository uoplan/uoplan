import { page } from "vitest/browser";
import { describe, expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { NormalizedCourseCode } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { renderWithProviders } from "../../test/renderWithProviders";
import { SearchResultCourseCard } from "./SearchResultCourseCard";

function norm(code: string): NormalizedCourseCode {
  return code as NormalizedCourseCode;
}

function makeCourseEntry(
  entry: Partial<ExploreCourseSearchEntry> &
    Pick<ExploreCourseSearchEntry, "normCode" | "courseCode" | "componentId">,
): ExploreCourseSearchEntry {
  return {
    courseTitle: "",
    fuseText: `${entry.courseCode} ${entry.courseTitle ?? ""}`.toLowerCase(),
    gradeViz: null,
    level: null,
    language: null,
    maxProfessorRating: null,
    ...entry,
  };
}

const BRANDED_VIRTUAL_ENTRY = makeCourseEntry({
  normCode: norm("CSI 3140"),
  courseCode: norm("CSI 3140"),
  courseTitle: "Brand Systems Studio",
  componentId: norm("CSI 3140"),
});

const BRANDED_IN_PERSON_ENTRY = makeCourseEntry({
  normCode: norm("SEG 3125"),
  courseCode: norm("SEG 3125"),
  courseTitle: "Brand Experience Lab",
  componentId: norm("SEG 3125"),
});

function buildRouter(entry: ExploreCourseSearchEntry, virtual: boolean) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <div style={{ width: 320 }}>
        <SearchResultCourseCard
          entry={entry}
          searchParams={EMPTY_EXPLORE_SEARCH}
          virtual={virtual}
        />
      </div>
    ),
  });
  const courseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/course/$course",
    component: () => <div>COURSE PAGE</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, courseRoute]);
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
}

describe("SearchResultCourseCard delivery badge", () => {
  test("shows the exact Virtual badge text for virtual results", async () => {
    await renderWithProviders(<RouterProvider router={buildRouter(BRANDED_VIRTUAL_ENTRY, true)} />);

    await expect
      .element(page.getByText(tr("explore.badge.virtual"), { exact: true }))
      .toBeInTheDocument();
  });

  test("omits the exact Virtual badge text for in-person results", async () => {
    await renderWithProviders(
      <RouterProvider router={buildRouter(BRANDED_IN_PERSON_ENTRY, false)} />,
    );

    await expect
      .element(page.getByText(tr("explore.badge.virtual"), { exact: true }))
      .not.toBeInTheDocument();
  });
});
