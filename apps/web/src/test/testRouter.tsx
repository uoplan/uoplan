import type { ReactNode } from "react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

interface TestRouterOptions {
  /** Initial history entries (the first is the starting location). Defaults to `["/"]`. */
  initialEntries?: string[];
  /**
   * Content rendered on every route above the `<Outlet />` — e.g. a layout-level
   * component under test (a banner, nav chrome) that self-gates on the location.
   */
  layout?: ReactNode;
  /** Map of `path` → page element. Defaults to a single `/` page. */
  routes?: Record<string, ReactNode>;
}

/**
 * Builds an in-memory TanStack Router for browser component tests, wrapping the
 * boilerplate (root route + child routes + memory history) most tests otherwise
 * repeat. Render the returned router with
 * `renderWithProviders(<RouterProvider router={router} />)`.
 */
export function createTestRouter({
  initialEntries = ["/"],
  layout,
  routes = { "/": <div>PAGE</div> },
}: TestRouterOptions = {}) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {layout}
        <Outlet />
      </>
    ),
  });
  const children = Object.entries(routes).map(([path, element]) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <>{element}</> }),
  );
  const routeTree = rootRoute.addChildren(children);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
}
