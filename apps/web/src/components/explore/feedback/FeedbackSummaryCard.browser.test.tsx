import { page } from "vitest/browser";
import { expect, test } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { FeedbackSectionView } from "@uoplan/core";

import { FeedbackSummaryCard } from "./FeedbackSummaryCard";
import { renderWithProviders } from "../../../test/renderWithProviders";

const views: FeedbackSectionView[] = [2231, 2235, 2239, 2241, 2245].map((termId, i) => ({
  termId,
  section: "A00",
  professorName: "Test Prof",
  registered: 100,
  questions: [{ questionId: 0, average: 4 + (i % 3) * 0.3, responses: 80, registered: 100 }],
}));

function buildRouter() {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    // Constrain to the real aside width to catch a chart that collapses to 0px.
    component: () => (
      <div style={{ width: 420 }}>
        <FeedbackSummaryCard
          to="/explore/course/$course/feedback"
          params={{ course: "csi2110" }}
          views={views}
          loading={false}
        />
      </div>
    ),
  });
  const feedbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore/course/$course/feedback",
    component: () => <div>FEEDBACK PAGE</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, feedbackRoute]);
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
}

test("renders the sentiment sparkline (non-zero width) and inline stats in a narrow aside", async () => {
  const router = buildRouter();
  const { container } = await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("Student evaluations")).toBeInTheDocument();
  await expect.element(page.getByText("Sentiment")).toBeInTheDocument();
  await expect.element(page.getByText("Responses")).toBeInTheDocument();

  // The chart line must actually render an SVG curve with a real width.
  await expect
    .poll(() => container.querySelectorAll("svg.recharts-surface path.recharts-curve").length)
    .toBeGreaterThan(0);
  const surface = container.querySelector("svg.recharts-surface") as SVGSVGElement | null;
  expect(surface).not.toBeNull();
  expect(surface!.getBoundingClientRect().width).toBeGreaterThan(60);
});
