import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { BasicCourseFiltersCard } from "./CourseFiltersCard";
import { renderWithProviders } from "../../test/renderWithProviders";

function renderFilters(overrides: Partial<Parameters<typeof BasicCourseFiltersCard>[0]> = {}) {
  const props: Parameters<typeof BasicCourseFiltersCard>[0] = {
    levelBuckets: ["undergrad"],
    languageBuckets: ["en"],
    electiveLevelBuckets: [],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    onChangeLevelBuckets: vi.fn(),
    onChangeLanguageBuckets: vi.fn(),
    onChangeElectiveLevelBuckets: vi.fn(),
    onIncludeClosedComponentsChange: vi.fn(),
    onVirtualSectionsOnlyChange: vi.fn(),
    ...overrides,
  };
  return { props, rendered: renderWithProviders(<BasicCourseFiltersCard {...props} />) };
}

test("uses friendly elective-level presets backed by electiveLevelBuckets", async () => {
  const onChangeElectiveLevelBuckets = vi.fn();
  const { rendered } = renderFilters({ onChangeElectiveLevelBuckets });
  await rendered;

  await expect.element(page.getByText("Any 1000–4000")).toBeInTheDocument();
  await page.getByText("3000–4000").click();

  expect(onChangeElectiveLevelBuckets).toHaveBeenCalledWith([3000, 4000]);
});

test("shows graduate elective-level presets only when graduate levels are relevant", async () => {
  const { rendered: undergradRendered } = renderFilters();
  await undergradRendered;
  await expect.element(page.getByText("Graduate only")).not.toBeInTheDocument();

  const { rendered: gradRendered } = renderFilters({ showGraduateElectiveLevels: true });
  await gradRendered;
  await expect.element(page.getByText("Graduate only")).toBeInTheDocument();
});

test("gives the elective-level preset control a programmatic label", async () => {
  const { rendered } = renderFilters();
  await rendered;

  await expect.element(page.getByRole("radiogroup", { name: "Levels" })).toBeInTheDocument();
});
