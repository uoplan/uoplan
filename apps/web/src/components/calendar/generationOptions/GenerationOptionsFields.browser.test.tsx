import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { GenerationOptionsFields } from "./GenerationOptionsFields";
import { makeGenerationOptionsProps } from "./testHelpers";
import { renderWithProviders } from "../../../test/renderWithProviders";

function baseProps() {
  return makeGenerationOptionsProps({
    courseOptions: [{ value: "CSI 2110", label: "CSI 2110" }],
    countMax: 8,
    minStartMinutes: 8 * 60,
    maxEndMinutes: 18 * 60,
  });
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
  await expect.element(page.getByText("Electives this semester (additional)")).toBeInTheDocument();
  await expect.element(page.getByText("Class times between")).toBeInTheDocument();
  await expect.element(page.getByText("Smart options")).toBeInTheDocument();
  await expect.element(page.getByText("Compressed schedule")).not.toBeVisible();

  const toggle = page.getByRole("button", { name: /More options/i });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(toggle).toHaveAttribute("aria-controls", "test-more-options-collapse");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByText("French immersion stream")).toBeInTheDocument();
});

test("smart options expands child preferences and toggles them as a group", async () => {
  const onCompressedScheduleChange = vi.fn();
  const onPreferEasierCoursesChange = vi.fn();
  const onPreferHigherSentimentChange = vi.fn();
  const onMinProfessorRatingChange = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      compressedSchedule={false}
      preferEasierCourses={false}
      preferHigherSentiment={false}
      minProfessorRating={null}
      onCompressedScheduleChange={onCompressedScheduleChange}
      onPreferEasierCoursesChange={onPreferEasierCoursesChange}
      onPreferHigherSentimentChange={onPreferHigherSentimentChange}
      onMinProfessorRatingChange={onMinProfessorRatingChange}
    />,
  );

  const expand = page.getByRole("button", { name: /Show smart options/i });
  await expand.click();
  await expect.element(page.getByText("Compressed schedule")).toBeInTheDocument();
  await expect.element(page.getByText("Prefer professors with better ratings")).toBeInTheDocument();
  await expect.element(page.getByText("Minimum RateMyProfessors rating")).not.toBeInTheDocument();

  await page.getByRole("checkbox", { name: "Smart options" }).click();

  expect(onCompressedScheduleChange).toHaveBeenCalledWith(true);
  expect(onPreferEasierCoursesChange).toHaveBeenCalledWith(true);
  expect(onPreferHigherSentimentChange).toHaveBeenCalledWith(true);
  expect(onMinProfessorRatingChange).toHaveBeenCalledWith(2);
});

test("smart options clears the lenient professor-rating baseline when toggled off", async () => {
  const onMinProfessorRatingChange = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      compressedSchedule
      preferEasierCourses
      preferHigherSentiment
      minProfessorRating={2}
      onMinProfessorRatingChange={onMinProfessorRatingChange}
    />,
  );

  await page.getByRole("checkbox", { name: "Smart options" }).click();

  expect(onMinProfessorRatingChange).toHaveBeenCalledWith(null);
});

test("professor-rating smart option maps to the lenient minimum rating", async () => {
  const onMinProfessorRatingChange = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      minProfessorRating={null}
      onMinProfessorRatingChange={onMinProfessorRatingChange}
    />,
  );

  await page.getByRole("button", { name: /Show smart options/i }).click();
  await page.getByRole("checkbox", { name: "Prefer professors with better ratings" }).click();

  expect(onMinProfessorRatingChange).toHaveBeenCalledWith(2);
});
