import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { DesiredCourseWarnings } from "./DesiredCourseWarnings";
import type { DesiredCourseResolution } from "../../../lib/generation/resolveDesiredCourses";
import { renderWithProviders } from "../../../test/renderWithProviders";

function emptyResolution(
  overrides: Partial<DesiredCourseResolution> = {},
): DesiredCourseResolution {
  return {
    assigned: {},
    standalone: [],
    prereqUnmet: [],
    noRequirement: [],
    overflow: [],
    completed: [],
    unavailable: [],
    ...overrides,
  };
}

test("renders nothing when there is no feedback", async () => {
  await renderWithProviders(
    <DesiredCourseWarnings resolution={emptyResolution()} assignments={[]} />,
  );
  expect(document.querySelector('[data-testid="desired-course-warnings"]')).toBeNull();
});

test("shows which requirement each assigned course counts toward", async () => {
  await renderWithProviders(
    <DesiredCourseWarnings
      resolution={emptyResolution()}
      assignments={[{ requirementTitle: "Computer Science electives", codes: ["CSI 3120"] }]}
    />,
  );
  await expect.element(page.getByText("CSI 3120")).toBeInTheDocument();
  await expect
    .element(page.getByText("Computer Science electives", { exact: false }))
    .toBeInTheDocument();
});

test("warns about courses that match no remaining requirement", async () => {
  await renderWithProviders(
    <DesiredCourseWarnings
      resolution={emptyResolution({ noRequirement: ["HIS 1110"] })}
      assignments={[]}
    />,
  );
  await expect.element(page.getByText("HIS 1110")).toBeInTheDocument();
});

test("warns about courses that overflow a full requirement", async () => {
  await renderWithProviders(
    <DesiredCourseWarnings
      resolution={emptyResolution({ overflow: ["CSI 2120"] })}
      assignments={[]}
    />,
  );
  await expect.element(page.getByText("CSI 2120")).toBeInTheDocument();
});
