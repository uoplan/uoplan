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
  const courseFeedbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/course/$course/feedback",
    component: () => (
      <BackButton
        fallbackTo="/explore/course/$course"
        fallbackParams={{ course: courseFeedbackRoute.useParams().course }}
      />
    ),
  });
  const professorFeedbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/professor/$slug/feedback",
    component: () => (
      <BackButton
        fallbackTo="/explore/professor/$slug"
        fallbackParams={{ slug: professorFeedbackRoute.useParams().slug }}
      />
    ),
  });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    courseRoute,
    professorRoute,
    detailRoute,
    courseFeedbackRoute,
    professorFeedbackRoute,
  ]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
}

test("navigates to fallbackTo even with no in-app history", async () => {
  const router = buildRouter(["/detail"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("Home fallback")).toBeInTheDocument();

  await page.getByRole("button").click();

  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});

test("navigates to fallbackTo even when in-app history could pop elsewhere", async () => {
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);
  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();

  // Forward nav from Home: browser history could pop back to "/", but the
  // detail page's own fallbackTo is "/" too here, so use a course page as the
  // "history would disagree" case instead.
  await router.navigate({ to: "/explore/course/$course", params: { course: "csi4108" } } as never);
  await expect.element(page.getByText("COURSE PAGE")).toBeInTheDocument();
  await router.navigate({ to: "/detail" } as never);

  // Always labelled and targeted from fallbackTo, never from history.
  await expect.element(page.getByText("Home fallback")).toBeInTheDocument();
  await page.getByRole("button").click();
  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});

test("derives a course-code label from an interpolated fallbackTo + fallbackParams", async () => {
  const router = buildRouter(["/explore/course/csi4108/feedback"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("CSI 4108")).toBeInTheDocument();

  await page.getByRole("button").click();
  await expect.element(page.getByText("COURSE PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/explore/course/csi4108");
});

test("labels an interpolated professor fallbackTo with the canonical name from the registry", async () => {
  const registry = buildProfessorRegistry([
    {
      slug: unsafeBrand<ProfessorSlug>("ada-lovelace"),
      name: testProfessorName("Ada Lovelace"),
      legacyIds: [123],
      aliases: [],
    },
  ]);
  const router = buildRouter(["/explore/professor/ada-lovelace/feedback"]);
  await renderWithProviders(<RouterProvider router={router} />, {
    initialState: { professors: registry },
  });

  await expect.element(page.getByText("Ada Lovelace")).toBeInTheDocument();

  await page.getByRole("button").click();
  await expect.element(page.getByText("PROF PAGE")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/explore/professor/ada-lovelace");
});
