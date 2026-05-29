import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { ScheduleCountStep } from "./ScheduleCountStep";
import { renderWithProviders } from "../../test/renderWithProviders";

function baseProps() {
  return {
    coursesThisSemester: 5,
    onCoursesChange: vi.fn(),
    selectedCount: 5,
    minStartMinutes: 8 * 60 + 30,
    onMinStartMinutesChange: vi.fn(),
    maxEndMinutes: 22 * 60,
    onMaxEndMinutesChange: vi.fn(),
    allowedDays: ["Mo", "Tu", "We", "Th", "Fr"] as const,
    onAllowedDaysChange: vi.fn(),
    minProfessorRating: null,
    onMinProfessorRatingChange: vi.fn(),
    totalFirstYearCredits: 0,
    warnFirstYearLimit: false,
    limitFirstYearCredits: true,
    onLimitFirstYearCreditsChange: vi.fn(),
    compressedSchedule: false,
    onCompressedScheduleChange: vi.fn(),
    preferEasierCourses: false,
    onPreferEasierCoursesChange: vi.fn(),
    blacklistedCourses: [],
    allPoolCourses: [],
    onBlacklistedCoursesChange: vi.fn(),
    onGenerate: vi.fn(),
  };
}

test("fires onGenerate when the generate button is clicked", async () => {
  const props = baseProps();
  await renderWithProviders(<ScheduleCountStep {...props} allowedDays={[...props.allowedDays]} />);

  const button = page.getByRole("button", { name: "Generate Schedules" });
  await expect.element(button).toBeInTheDocument();
  await button.click();

  expect(props.onGenerate).toHaveBeenCalledOnce();
});

test("reflects preferEasier state and toggles it via the checkbox", async () => {
  const props = baseProps();
  await renderWithProviders(<ScheduleCountStep {...props} allowedDays={[...props.allowedDays]} />);

  const checkbox = page.getByRole("checkbox", { name: /Prefer easier courses/ });
  await expect.element(checkbox).not.toBeChecked();
  await checkbox.click();

  expect(props.onPreferEasierCoursesChange).toHaveBeenCalledWith(true);
});
