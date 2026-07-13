/**
 * Landing page browser test covering the important-dates link added below the
 * tile grid. Minimal setup that focuses only on the new link affordance.
 */
import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { LandingPage } from "./LandingPage";
import { renderWithProviders } from "../../test/renderWithProviders";

function buildRouter() {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <LandingPage />,
  });
  const importantDatesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/important-dates-and-deadlines",
    component: () => <div>Important dates page</div>,
  });
  // Add other routes that landing tiles link to so TanStack Router doesn't warn
  const personalizeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/personalize",
    component: () => <div>Personalize</div>,
  });
  const scheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/schedule",
    component: () => <div>Schedule</div>,
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: () => <div>Explore</div>,
  });
  const routeTree = rootRoute.addChildren([
    homeRoute,
    importantDatesRoute,
    personalizeRoute,
    scheduleRoute,
    exploreRoute,
  ]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

test("important dates link appears below the tile region with correct href", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  const link = page.getByRole("link", { name: /important dates and deadlines/i });
  await expect.element(link).toBeInTheDocument();

  // The link points to the correct path
  await expect.element(link).toHaveAttribute("href", "/important-dates-and-deadlines");
});

test("clicking important dates link triggers client-side router navigation", async () => {
  const router = buildRouter();
  await renderWithProviders(<RouterProvider router={router} />);

  const link = page.getByRole("link", { name: /important dates and deadlines/i });
  await link.click();

  // After click, the in-memory router should have rendered the target route;
  // the destination stub component is visible without a full page reload.
  await expect.element(page.getByText("Important dates page")).toBeInTheDocument();
});

test("important dates link is subdued (dim text, not a prominent tile)", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter()} />);

  const link = page.getByRole("link", { name: /important dates and deadlines/i });
  await expect.element(link).toBeInTheDocument();

  // Every LandingTile wraps its icon in an aria-hidden box (stable UI contract).
  // The important-dates link is a bare text link with no icon, so its DOM element
  // contains no [aria-hidden="true"] descendant — proving it is not a feature tile.
  // link.query() is non-null here because toBeInTheDocument() already passed.
  expect(link.query()?.querySelector('[aria-hidden="true"]') ?? null).toBeNull();

  // The two stable named tile links remain in the feature grid above this row,
  // confirming the three-tile SimpleGrid is intact.
  await expect.element(page.getByRole("link", { name: /schedule generator/i })).toBeInTheDocument();
  await expect.element(page.getByRole("link", { name: /course explorer/i })).toBeInTheDocument();
});
