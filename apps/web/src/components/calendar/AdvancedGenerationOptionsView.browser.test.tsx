import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import {
  AdvancedGenerationOptionsView,
  type AdvancedGenerationOptionsViewProps,
} from "./AdvancedGenerationOptionsView";
import type { GenerationOptionsFieldsProps } from "./generationOptions/GenerationOptionsFields";
import type { ConstrainStepProps } from "../requirements/ConstrainStep";
import { renderWithProviders } from "../../test/renderWithProviders";

function fields(): GenerationOptionsFieldsProps {
  return {
    courseOptions: [],
    desiredCourses: [],
    onDesiredCoursesChange: vi.fn(),
    countValue: 5,
    onCountChange: vi.fn(),
    countMin: 1,
    countMax: 10,
    totalFirstYearCredits: 0,
    warnFirstYearLimit: false,
    limitFirstYearCredits: false,
    onLimitFirstYearCreditsChange: vi.fn(),
    compressedSchedule: false,
    onCompressedScheduleChange: vi.fn(),
    preferEasierCourses: false,
    onPreferEasierCoursesChange: vi.fn(),
    minStartMinutes: 0,
    onMinStartMinutesChange: vi.fn(),
    maxEndMinutes: 1440,
    onMaxEndMinutesChange: vi.fn(),
    avoidedDays: [],
    onAvoidedDaysChange: vi.fn(),
    minProfessorRating: null,
    onMinProfessorRatingChange: vi.fn(),
    levelBuckets: [],
    languageBuckets: [],
    electiveLevelBuckets: [],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    onChangeLevelBuckets: vi.fn(),
    onChangeLanguageBuckets: vi.fn(),
    onChangeElectiveLevelBuckets: vi.fn(),
    onIncludeClosedComponentsChange: vi.fn(),
    onVirtualSectionsOnlyChange: vi.fn(),
    excludeSubjects: { data: [], value: [], onChange: vi.fn() },
    excludeCourses: { data: [], value: [], onChange: vi.fn() },
    frenchImmersionStream: false,
    onFrenchImmersionStreamChange: vi.fn(),
  };
}

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
    fields: fields(),
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
