import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { FeedbackQuestionMeta, FeedbackSectionView } from "@uoplan/core";

import { ExploreFeedbackContent } from "./ExploreFeedbackContent";
import { renderWithProviders } from "../../../test/renderWithProviders";

const questions: FeedbackQuestionMeta[] = [
  {
    text: "The course is well organized",
    scale: true,
    // best-first: index 0 -> score 5 (high), last -> score 1 (low)
    options: [
      "strongly agree",
      "agree",
      "neither agree nor disagree",
      "disagree",
      "strongly disagree",
    ],
  },
];

const views: FeedbackSectionView[] = [2239, 2241, 2245].map((termId, i) => ({
  termId,
  section: "A00",
  professorName: "Test Prof",
  registered: 100,
  questions: [{ questionId: 0, average: 4 + i * 0.2, responses: 70, registered: 100 }],
}));

function buildRouter() {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <ExploreFeedbackContent
        title="CSI 2110"
        views={views}
        questions={questions}
        loading={false}
      />
    ),
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: () => <div>EXPLORE</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, exploreRoute]);
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
}

test("renders a thin 1-5 scale legend with the best (5) and worst (1) option labels", async () => {
  await page.viewport(1280, 900);
  const router = buildRouter();
  await renderWithProviders(<RouterProvider router={router} />);

  // Endpoints: 1 paired with the worst option, 5 with the best.
  await expect.element(page.getByText("Strongly disagree")).toBeInTheDocument();
  await expect.element(page.getByText("Strongly agree")).toBeInTheDocument();
  await expect.element(page.getByText("1", { exact: true })).toBeInTheDocument();
  await expect.element(page.getByText("5", { exact: true })).toBeInTheDocument();
});
