import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import {
  AdvancedGenerationOptionsView,
  type AdvancedGenerationOptionsViewProps,
} from "./AdvancedGenerationOptionsView";
import { makeGenerationOptionsProps } from "./generationOptions/testHelpers";
import type { ConstrainStepProps } from "../requirements/ConstrainStep";
import { renderWithProviders } from "../../test/renderWithProviders";

function constrain(): ConstrainStepProps {
  return {
    cache: null,
    remainingRequirements: [],
    requirementTreeWithStatus: [],
    completedRequirementsList: [],
    completedCourses: [],
    selectedPerRequirement: {},
    constrainedPerRequirement: {},
    onConstrain: vi.fn(),
    selectedOptionsPerRequirement: {},
    prereqEligibleCourses: [],
    levelBuckets: [],
    languageBuckets: [],
    electiveLevelBuckets: [],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
  };
}

function baseProps(): AdvancedGenerationOptionsViewProps {
  return {
    fields: makeGenerationOptionsProps(),
    constrain: constrain(),
    advancedPicksCount: 0,
  };
}

test("renders the unified options with the advanced panel collapsed", async () => {
  await renderWithProviders(<AdvancedGenerationOptionsView {...baseProps()} />);

  await expect.element(page.getByTestId("advanced-generation-options")).toBeInTheDocument();
  await expect.element(page.getByTestId("generation-options-fields")).toBeInTheDocument();
  // The collapsible advanced-options panel starts closed.
  const toggle = page.getByRole("button", { name: /Advanced options/i });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
});

test("expands the advanced-options panel when the header is clicked", async () => {
  await renderWithProviders(<AdvancedGenerationOptionsView {...baseProps()} />);

  const toggle = page.getByRole("button", { name: /Advanced options/i });
  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
});
