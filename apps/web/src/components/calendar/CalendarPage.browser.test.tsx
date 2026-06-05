import { page } from "vitest/browser";
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

import { CalendarPage } from "./CalendarPage";
import { renderWithProviders } from "../../test/renderWithProviders";

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
        code: "CSI 4900",
        title: "Honours Project",
        credits: 3,
        description: "",
      },
      {
        code: "CSI 3105",
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
      courseCode: "CSI 4900",
      sectionCombo: {},
      times: [],
    },
    {
      courseCode: "CSI 3105",
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

  await expect
    .element(page.getByText("Some courses don't appear on the schedule"))
    .toBeInTheDocument();
  await expect.element(page.getByText("CSI 4900: Honours Project")).toBeInTheDocument();
  await expect
    .element(page.getByText("CSI 3105: Design and Analysis of Algorithms"))
    .not.toBeInTheDocument();
});
