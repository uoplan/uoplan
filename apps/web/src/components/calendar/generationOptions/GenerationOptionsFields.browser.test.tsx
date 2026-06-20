import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { GenerationOptionsFields } from "./GenerationOptionsFields";
import { makeGenerationOptionsProps } from "./testHelpers";
import { renderWithProviders } from "../../../test/renderWithProviders";

function baseProps() {
  return makeGenerationOptionsProps({
    countMax: 8,
    minStartMinutes: 8 * 60,
    maxEndMinutes: 18 * 60,
  });
}

const OPEN_ADVANCED = {
  collapseId: "test-advanced-options-collapse",
  defaultOpen: true,
} as const;

test("tucks every lower-priority control behind a single Advanced options disclosure", async () => {
  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      advancedOptions={{
        collapseId: "test-advanced-options-collapse",
        badge: { label: "Optional", color: "gray" },
      }}
    />,
  );

  // Always-visible: the course count input.
  await expect.element(page.getByText("Electives this semester (additional)")).toBeInTheDocument();

  // Collapsed disclosure: heading + bullet summary visible, controls hidden.
  const toggle = page.getByRole("button", { name: /Advanced options/i });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(toggle).toHaveAttribute("aria-controls", "test-advanced-options-collapse");
  await expect.element(page.getByText(/Class times$/)).toBeInTheDocument();
  await expect.element(page.getByText(/Days to avoid$/)).toBeInTheDocument();
  await expect.element(page.getByText("Class times between")).not.toBeVisible();

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByText("Class times between")).toBeVisible();
  await expect.element(page.getByText("Days of the week to avoid")).toBeVisible();
  await expect.element(page.getByText("French immersion stream")).toBeVisible();
});

test("renders extra disclosure content and an extra summary bullet", async () => {
  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      advancedOptions={{
        collapseId: "test-advanced-options-collapse",
        extraSummaryItem: "Pick specific courses",
        extraContent: <div data-testid="extra-panel">extra panel</div>,
      }}
    />,
  );

  await expect.element(page.getByText(/Pick specific courses$/)).toBeInTheDocument();

  await page.getByRole("button", { name: /Advanced options/i }).click();
  await expect.element(page.getByTestId("extra-panel")).toBeVisible();
});

test("smart options expands child preferences and toggles them as a group", async () => {
  const onCompressedScheduleChange = vi.fn();
  const onPreferEasierCoursesChange = vi.fn();
  const onPreferHigherSentimentChange = vi.fn();
  const onMinProfessorRatingChange = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      advancedOptions={OPEN_ADVANCED}
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
      advancedOptions={OPEN_ADVANCED}
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
      advancedOptions={OPEN_ADVANCED}
      minProfessorRating={null}
      onMinProfessorRatingChange={onMinProfessorRatingChange}
    />,
  );

  await page.getByRole("button", { name: /Show smart options/i }).click();
  await page.getByRole("checkbox", { name: "Prefer professors with better ratings" }).click();

  expect(onMinProfessorRatingChange).toHaveBeenCalledWith(2);
});
