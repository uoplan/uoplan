import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { BasketContents } from "./BasketContents";
import { renderWithProviders } from "../../test/renderWithProviders";

function buildRouter(onNavigate?: () => void) {
  const rootRoute = createRootRoute();
  const basketRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/basket",
    component: () => <BasketContents variant="embedded" onNavigate={onNavigate} />,
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: () => <div>Explore page</div>,
  });
  const personalizeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/personalize",
    component: () => <div>Personalize page</div>,
  });
  const routeTree = rootRoute.addChildren([basketRoute, exploreRoute, personalizeRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/basket"] }),
  });
}

test("empty basket keeps summary stats visible and links to explore", async () => {
  const onNavigate = vi.fn();
  const router = buildRouter(onNavigate);

  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("Your basket", { exact: true })).toBeInTheDocument();
  await expect.element(page.getByLabelText("Courses in your basket: 0")).toBeInTheDocument();
  await expect.element(page.getByLabelText("Total credits: 0")).toBeInTheDocument();
  await expect.element(page.getByText("Your basket is empty", { exact: true })).toBeInTheDocument();

  await page.getByRole("link", { name: "Browse courses" }).click();

  expect(onNavigate).toHaveBeenCalledOnce();
  expect(router.state.location.pathname).toBe("/explore");
});

test("basket body starts expanded with courses and collapses from the summary header", async () => {
  const router = buildRouter();

  await renderWithProviders(<RouterProvider router={router} />, {
    initialState: { basketCourses: ["CSI 2110"] },
  });

  const toggle = page.getByRole("button", { name: "Collapse basket summary" });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByText("CSI 2110", { exact: true })).toBeVisible();

  await toggle.click();

  await expect
    .element(page.getByRole("button", { name: "Expand basket summary" }))
    .toHaveAttribute("aria-expanded", "false");
  await expect.element(page.getByText("CSI 2110", { exact: true })).not.toBeVisible();
  await expect.element(page.getByLabelText("Courses in your basket: 1")).toBeInTheDocument();
});

test("clicking a basket course row removes it", async () => {
  const router = buildRouter();

  await renderWithProviders(<RouterProvider router={router} />, {
    initialState: { basketCourses: ["CSI 2110"] },
  });

  const row = page.getByRole("button", { name: "Remove CSI 2110" });
  await expect.element(row).toBeInTheDocument();

  await row.click();

  await expect.element(page.getByText("Your basket is empty", { exact: true })).toBeInTheDocument();
});
