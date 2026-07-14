import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { FeatureShowcase } from "./FeatureShowcase";
import { renderWithProviders } from "../../test/renderWithProviders";

function buildRouter() {
  const rootRoute = createRootRoute();
  const featuresRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/features",
    component: () => <FeatureShowcase />,
  });
  const scheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/schedule",
    component: () => <div>Schedule page</div>,
  });
  const compareRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/compare",
    component: () => <div>Compare page</div>,
  });
  const vsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/vs/$competitor",
    component: () => <div>Vs page</div>,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([featuresRoute, scheduleRoute, compareRoute, vsRoute]),
    history: createMemoryHistory({ initialEntries: ["/features"] }),
  });
}

test("features and shared comparison CTAs advertise quick scheduling", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  const quickScheduleLink = page.getByRole("link", { name: "Build a quick schedule" }).nth(0);
  await expect.element(quickScheduleLink).toHaveAttribute("href", "/schedule");
  await expect
    .element(page.getByRole("link", { name: "Build a quick schedule" }).nth(1))
    .toHaveAttribute("href", "/schedule");
  await expect
    .element(
      page.getByText(
        "Add the courses you want and generate a conflict-free timetable—no program setup required.",
      ),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        /Add courses and generate right away, or map requirements across your whole degree/,
      ),
    )
    .toBeVisible();
});
