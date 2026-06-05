import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import { CompletedCoursesStep } from "./CompletedCoursesStep";

const flsRequirement = {
  requirementId: "fls-companion",
  type: "course",
  title: "FLS companion",
  candidateCourses: ["FLS 2581", "CSI 2101"],
  satisfiedBy: [],
};

test("hides repeatable controls until a repeatable course is completed", async () => {
  await renderWithProviders(
    <CompletedCoursesStep
      cache={null}
      remainingRequirements={[flsRequirement]}
      completedCourses={[]}
      onChange={vi.fn()}
      hasProgram
    />,
  );

  expect(document.body.textContent).not.toContain("Repeatable courses");
});

test("shows repeatable controls for repeatable completed courses", async () => {
  await renderWithProviders(
    <CompletedCoursesStep
      cache={null}
      remainingRequirements={[flsRequirement]}
      completedCourses={["FLS 2581"]}
      onChange={vi.fn()}
      hasProgram
    />,
  );

  await expect.element(page.getByText("Repeatable courses")).toBeInTheDocument();
  await expect.element(page.getByText("FLS 2581")).toBeInTheDocument();
});
