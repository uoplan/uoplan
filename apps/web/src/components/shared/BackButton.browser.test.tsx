import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { buildProfessorRegistry, unsafeBrand } from "@uoplan/core";
import type { ProfessorSlug } from "@uoplan/core";

import { BackButton } from "./BackButton";
import { __resetNavigationHistory, recordLocation } from "../../lib/navigation/navigationHistory";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testProfessorName } from "../../test/brands";

function buildRouter(initialEntries: string[]) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>HOME PAGE</div>,
  });
  const courseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/course/$course",
    component: () => <div>COURSE PAGE</div>,
  });
  const professorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/professor/$slug",
    component: () => <div>PROF PAGE</div>,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/detail",
    component: () => <BackButton fallbackTo="/" fallbackLabel="Home fallback" />,
  });
  const routeTree = rootRoute.addChildren([indexRoute, courseRoute, professorRoute, detailRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
}

async function expectBackButtonNavigatesHome(
  router: ReturnType<typeof buildRouter>,
  label: string,
) {
  await expect.element(page.getByText(label)).toBeInTheDocument();

  await page.getByRole("button").click();

  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
}

test("falls back to navigating to the parent when there is no in-app history", async () => {
  const router = buildRouter(["/detail"]);
  await renderWithProviders(<RouterProvider router={router} />);

  // No in-app history to pop, so the fallback label is shown.
  await expectBackButtonNavigatesHome(router, "Home fallback");
});

/**
 * Mirror the root layout: seed the global tracker from the router's current
 * entry and feed every subsequent history change into it. Returns the
 * unsubscribe handle so the test can detach the listener when done.
 */
function wireTracker(router: ReturnType<typeof buildRouter>): () => void {
  const seed = router.history.location;
  recordLocation(seed.state.__TSR_index, seed.pathname, seed.search);
  return router.history.subscribe(({ location }) =>
    recordLocation(location.state.__TSR_index, location.pathname, location.search),
  );
}

test("labels from the globally-tracked previous page and pops history", async () => {
  __resetNavigationHistory();
  const router = buildRouter(["/"]);
  const unsubscribe = wireTracker(router);

  await renderWithProviders(<RouterProvider router={router} />);
  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();

  // Forward nav: the tracker knows the previous entry is "/".
  await router.navigate({ to: "/detail" } as never);

  // locationLabel("/") resolves to "Home" (not the "Home fallback" prop), proving
  // the label came from the tracker, and clicking pops history back to "/".
  await expectBackButtonNavigatesHome(router, "Home");
  unsubscribe();
  __resetNavigationHistory();
});

test("derives a course-code label from the tracked previous URL alone", async () => {
  __resetNavigationHistory();
  const router = buildRouter(["/explore/course/csi4108"]);
  const unsubscribe = wireTracker(router);

  await renderWithProviders(<RouterProvider router={router} />);
  await expect.element(page.getByText("COURSE PAGE")).toBeInTheDocument();

  // Forward nav from the course page: the tracker's previous entry is the course
  // URL, and locationLabel parses its code purely from the path.
  await router.navigate({ to: "/detail" } as never);

  await expect.element(page.getByText("CSI 4108")).toBeInTheDocument();

  // Clicking pops history back to the course page.
  await page.getByRole("button").click();
  await expect.element(page.getByText("COURSE PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/explore/course/csi4108");
  unsubscribe();
  __resetNavigationHistory();
});

test("labels a tracked professor previous page with the canonical name from the registry", async () => {
  __resetNavigationHistory();
  const registry = buildProfessorRegistry([
    {
      slug: unsafeBrand<ProfessorSlug>("ada-lovelace"),
      name: testProfessorName("Ada Lovelace"),
      legacyIds: [123],
      aliases: [],
    },
  ]);
  const router = buildRouter(["/explore/professor/ada-lovelace"]);
  const unsubscribe = wireTracker(router);

  await renderWithProviders(<RouterProvider router={router} />, {
    initialState: { professors: registry },
  });
  await expect.element(page.getByText("PROF PAGE")).toBeInTheDocument();

  // Forward nav from the professor page: the slug-only URL is resolved to the
  // canonical display name through the store-backed registry.
  await router.navigate({ to: "/detail" } as never);

  await expect.element(page.getByText("Ada Lovelace")).toBeInTheDocument();

  // Clicking pops history back to the professor page.
  await page.getByRole("button").click();
  await expect.element(page.getByText("PROF PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/explore/professor/ada-lovelace");
  unsubscribe();
  __resetNavigationHistory();
});
