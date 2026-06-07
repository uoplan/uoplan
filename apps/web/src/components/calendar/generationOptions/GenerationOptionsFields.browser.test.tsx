import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import {
  GenerationOptionsFields,
  type GenerationOptionsFieldsProps,
} from "./GenerationOptionsFields";
import { renderWithProviders } from "../../../test/renderWithProviders";

function baseProps(): GenerationOptionsFieldsProps {
  return {
    courseOptions: [{ value: "CSI 2110", label: "CSI 2110" }],
    desiredCourses: [],
    onDesiredCoursesChange: vi.fn(),
    countValue: 5,
    onCountChange: vi.fn(),
    countMin: 1,
    countMax: 8,
    totalFirstYearCredits: 0,
    warnFirstYearLimit: false,
    limitFirstYearCredits: false,
    onLimitFirstYearCreditsChange: vi.fn(),
    compressedSchedule: false,
    onCompressedScheduleChange: vi.fn(),
    preferEasierCourses: false,
    onPreferEasierCoursesChange: vi.fn(),
    preferHigherSentiment: false,
    onPreferHigherSentimentChange: vi.fn(),
    minStartMinutes: 8 * 60,
    onMinStartMinutesChange: vi.fn(),
    maxEndMinutes: 18 * 60,
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

test("surfaces common scheduling options and tucks filters behind a disclosure", async () => {
  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      secondaryOptionsDisclosure={{
        heading: "More options",
        badgeLabel: "Optional",
        collapseId: "test-more-options-collapse",
      }}
    />,
  );

  await expect.element(page.getByText("Courses you want")).toBeInTheDocument();
  await expect.element(page.getByText("Courses this semester")).toBeInTheDocument();
  // Common scheduling preferences are now surfaced directly, not hidden.
  await expect.element(page.getByText("Earliest class start")).toBeInTheDocument();
  await expect.element(page.getByText("Compressed schedule")).toBeInTheDocument();
  await expect.element(page.getByText("Prefer courses with better feedback")).toBeInTheDocument();

  const toggle = page.getByRole("button", { name: /More options/i });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(toggle).toHaveAttribute("aria-controls", "test-more-options-collapse");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByText("French immersion stream")).toBeInTheDocument();
});
