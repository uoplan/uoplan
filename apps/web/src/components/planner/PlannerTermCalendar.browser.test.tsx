import { page } from "vitest/browser";
import { type ReactElement, useState } from "react";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, GeneratedSchedule, SchedulesData } from "@uoplan/core";

import { PlannerTermCalendar } from "./PlannerTermCalendar";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testCourseCode } from "../../test/brands";

/**
 * The planner term calendar renders a `<Link>` to the explore page inside its
 * read-only popover, so it needs a router. We mount `Body` on `/graph` and add
 * the matching `/explore/course/$course` route so the link resolves.
 */
function buildRouterWith(Body: () => ReactElement) {
  const rootRoute = createRootRoute();
  const graphRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/graph",
    component: Body,
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/course/$course",
    component: () => <div>Explore</div>,
  });
  const routeTree = rootRoute.addChildren([graphRoute, exploreRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/graph"] }),
  });
}

function buildRouter() {
  return buildRouterWith(() => (
    <div style={{ width: 520, height: 480, display: "flex" }}>
      <PlannerTermCalendar schedule={schedule} cache={buildCache()} professorRatings={null} />
    </div>
  ));
}

function buildCache() {
  const catalogue: Catalogue = {
    courses: [
      {
        code: testCourseCode("CSI 3105"),
        title: "Design and Analysis of Algorithms",
        credits: 3,
        description: "",
      },
      {
        code: testCourseCode("CSI 2110"),
        title: "Data Structures and Algorithms",
        credits: 3,
        description: "",
      },
    ],
    programs: [],
  };
  const schedules: SchedulesData = { termId: "0000", schedules: [] };
  return buildDataCache(catalogue, schedules);
}

function scheduleFor(code: string): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode: testCourseCode(code),
        sectionCombo: {
          LEC: {
            section: {
              section: "A00",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              times: [{ day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false }],
              status: null,
            },
          },
        },
        times: [{ day: "Mo", startMinutes: 600, endMinutes: 690 }],
      },
    ],
  };
}

const schedule: GeneratedSchedule = scheduleFor("CSI 3105");

test("renders the term's scheduled courses on the week grid", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  // The event face shows the course code on the grid (inside a button, not a link).
  await expect.element(page.getByRole("button", { name: /CSI 3105/ })).toBeInTheDocument();
});

test("opens a read-only details popover when a course is clicked", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  // No popover link before interacting.
  await expect.element(page.getByRole("link", { name: "CSI 3105" })).not.toBeInTheDocument();

  await page.getByRole("button", { name: /CSI 3105/ }).click();

  // The popover renders the course code as a link to explore plus the shared
  // read-only info section (Section / When rows).
  await expect.element(page.getByRole("link", { name: "CSI 3105" })).toBeInTheDocument();
  await expect.element(page.getByText("When", { exact: true })).toBeInTheDocument();
});

test("toggles the popover closed when the same course is clicked again", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  const eventButton = page.getByRole("button", { name: /CSI 3105/ });
  await eventButton.click();
  await expect.element(page.getByRole("link", { name: "CSI 3105" })).toBeInTheDocument();

  await eventButton.click();
  await expect.element(page.getByRole("link", { name: "CSI 3105" })).not.toBeInTheDocument();
});

/** A wrapper that swaps the schedule on a button click, to drive the animation. */
function SwappablePlanner() {
  const [alt, setAlt] = useState(false);
  return (
    <div style={{ width: 520, height: 480, display: "flex", flexDirection: "column" }}>
      <button type="button" onClick={() => setAlt(true)}>
        swap
      </button>
      <PlannerTermCalendar
        schedule={alt ? scheduleFor("CSI 2110") : schedule}
        cache={buildCache()}
        professorRatings={null}
      />
    </div>
  );
}

function buildSwapRouter() {
  return buildRouterWith(SwappablePlanner);
}

test("transitions to the new schedule when the term is regenerated", async () => {
  await renderWithProviders(<RouterProvider router={buildSwapRouter()} />);

  await expect.element(page.getByRole("button", { name: /CSI 3105/ })).toBeInTheDocument();

  await page.getByRole("button", { name: "swap" }).click();

  // The exit -> swap -> enter animation eventually shows the regenerated
  // schedule's course and drops the old one.
  await expect.element(page.getByRole("button", { name: /CSI 2110/ })).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /CSI 3105/ })).not.toBeInTheDocument();
});
