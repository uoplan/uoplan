import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import {
  AdvancedGenerationOptionsView,
  type AdvancedGenerationOptionsViewProps,
} from "./AdvancedGenerationOptionsView";
import { renderWithProviders } from "../../test/renderWithProviders";

function baseProps(): AdvancedGenerationOptionsViewProps {
  return {
    scheduleCount: {
      coursesThisSemester: 5,
      onCoursesChange: vi.fn(),
      selectedCount: 0,
      minStartMinutes: 0,
      onMinStartMinutesChange: vi.fn(),
      maxEndMinutes: 1440,
      onMaxEndMinutesChange: vi.fn(),
      avoidedDays: [],
      onAvoidedDaysChange: vi.fn(),
      minProfessorRating: null,
      onMinProfessorRatingChange: vi.fn(),
      totalFirstYearCredits: 0,
      warnFirstYearLimit: false,
      limitFirstYearCredits: false,
      onLimitFirstYearCreditsChange: vi.fn(),
      compressedSchedule: false,
      onCompressedScheduleChange: vi.fn(),
      preferEasierCourses: false,
      onPreferEasierCoursesChange: vi.fn(),
      blacklistedCourses: [],
      allPoolCourses: [],
      onBlacklistedCoursesChange: vi.fn(),
      onGenerate: vi.fn(),
      generating: false,
      error: null,
      errorDetails: null,
      disableGenerate: false,
    },
    constrain: {
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
      onChangeLevelBuckets: vi.fn(),
      onChangeLanguageBuckets: vi.fn(),
      electiveLevelBuckets: [],
      onChangeElectiveLevelBuckets: vi.fn(),
      includeClosedComponents: false,
      onIncludeClosedComponentsChange: vi.fn(),
      virtualSectionsOnly: false,
      onVirtualSectionsOnlyChange: vi.fn(),
    },
  };
}

test("renders the schedule-count controls with the constraints panel collapsed", async () => {
  await renderWithProviders(<AdvancedGenerationOptionsView {...baseProps()} />);

  await expect.element(page.getByTestId("advanced-generation-options")).toBeInTheDocument();
  // The collapsible constraints panel starts closed.
  const toggle = page.getByRole("button", { expanded: false });
  await expect.element(toggle).toBeInTheDocument();
});

test("expands the constraints panel when the header is clicked", async () => {
  await renderWithProviders(<AdvancedGenerationOptionsView {...baseProps()} />);

  const toggle = page.getByRole("button", { expanded: false });
  await toggle.click();
  await expect.element(page.getByRole("button", { expanded: true })).toBeInTheDocument();
});
