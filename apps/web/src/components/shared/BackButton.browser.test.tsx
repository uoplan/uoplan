import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { BackButton } from "./BackButton";
import { __resetNavigationHistory, recordLocation } from "../../lib/navigation/navigationHistory";
import { renderWithProviders } from "../../test/renderWithProviders";

function buildRouter(initialEntries: string[]) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>HOME PAGE</div>,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/detail",
    component: () => <BackButton fallbackTo="/" fallbackLabel="Home fallback" />,
  });
  const routeTree = rootRoute.addChildren([indexRoute, detailRoute]);
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

  // No state.back was set, so the fallback label is shown.
  await expectBackButtonNavigatesHome(router, "Home fallback");
});

test("pops browser history and uses the referrer label when state.back is present", async () => {
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();

  await router.navigate({
    to: "/detail",
    state: { back: { to: "/", label: "Back to home" } },
  } as never);

  // The label comes from the referrer-provided state.back, not the fallback.
  await expectBackButtonNavigatesHome(router, "Back to home");
});

test("labels from the globally-tracked previous page and pops when no state.back", async () => {
  __resetNavigationHistory();
  const router = buildRouter(["/"]);
  // Mirror the root layout: feed every history change into the tracker.
  const seed = router.history.location;
  recordLocation(seed.state.__TSR_index, seed.pathname, seed.search);
  const unsubscribe = router.history.subscribe(({ location }) =>
    recordLocation(location.state.__TSR_index, location.pathname, location.search),
  );

  await renderWithProviders(<RouterProvider router={router} />);
  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();

  // Forward nav with no state.back: the tracker knows the previous entry is "/".
  await router.navigate({ to: "/detail" } as never);

  // locationLabel("/") resolves to "Home" (not the "Home fallback" prop), proving
  // the label came from the tracker, and clicking pops history back to "/".
  await expectBackButtonNavigatesHome(router, "Home");
  unsubscribe();
  __resetNavigationHistory();
});
