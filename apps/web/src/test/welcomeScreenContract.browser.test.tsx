import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { WelcomeScreen } from "@uoplan/app";

import { WebNavigationProvider } from "../navigation/WebNavigationProvider";
import { renderWithProviders } from "./renderWithProviders";

/**
 * End-to-end proof of the write-once stack on the WEB shell: the shared
 * `WelcomeScreen` (authored in @uoplan/app against the ui + navigation
 * contracts) renders via Mantine `.web.tsx` primitives, and the
 * `WebNavigationProvider` (TanStack adapter) drives real navigation when a
 * destination button is pressed.
 */
function buildRouter(initialEntries: string[]) {
  const rootRoute = createRootRoute({
    component: () => (
      <WebNavigationProvider>
        <Outlet />
      </WebNavigationProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <WelcomeScreen />,
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: () => <div>EXPLORE PAGE</div>,
  });
  const personalizeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/personalize",
    component: () => <div>PERSONALIZE PAGE</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, exploreRoute, personalizeRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
}

test("WelcomeScreen renders via the web ui variants", async () => {
  await renderWithProviders(<RouterProvider router={buildRouter(["/"])} />);
  await expect.element(page.getByTestId("welcome-screen")).toBeInTheDocument();
  await expect.element(page.getByText("Plan your degree, one term at a time")).toBeInTheDocument();
});

test("pressing a destination navigates through the web NavigationProvider", async () => {
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await page.getByTestId("welcome-open-personalize").click();

  await expect.element(page.getByText("PERSONALIZE PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/personalize");
});
