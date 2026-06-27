import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { defaultOptimizationPriorities } from "@uoplan/core";

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

test("renders an optimization-priorities row per objective and toggles one", async () => {
  const onTogglePriority = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      optimizationPriorities={defaultOptimizationPriorities()}
      onTogglePriority={onTogglePriority}
    />,
  );

  // The card is always visible (not behind the Advanced disclosure).
  await expect.element(page.getByTestId("optimization-priorities-card")).toBeInTheDocument();
  await expect.element(page.getByTestId("optimization-priority-free_days")).toBeInTheDocument();
  await expect.element(page.getByTestId("optimization-priority-good_breaks")).toBeInTheDocument();
  await expect
    .element(page.getByTestId("optimization-priority-prefer_professor_rating"))
    .toBeInTheDocument();

  // free_days is off by default → toggling its switch enables it. (Mantine's
  // visible track overlays the hidden input, so force the click.)
  await page
    .getByTestId("optimization-priority-free_days")
    .getByRole("switch")
    .click({ force: true });
  expect(onTogglePriority).toHaveBeenCalledWith("free_days", true);
});

test("moves an enabled priority down via its reorder control", async () => {
  const onReorderPriorities = vi.fn();

  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      optimizationPriorities={defaultOptimizationPriorities()}
      onReorderPriorities={onReorderPriorities}
    />,
  );

  // prefer_easier is the first *enabled* priority (stored index 2); the timetable-shape
  // objectives (free_days, good_breaks) are off by default and sink, dimmed, to the bottom.
  // Its "move down" control swaps it with the next enabled priority (stored index 3).
  await page
    .getByTestId("optimization-priority-prefer_easier")
    .getByRole("button", { name: /move down/i })
    .click();

  expect(onReorderPriorities).toHaveBeenCalledWith(2, 3);
});

test("reveals break inputs only when good breaks is enabled", async () => {
  const enabledBreaks = defaultOptimizationPriorities().map((p) =>
    p.kind === "good_breaks" ? { ...p, enabled: true } : p,
  );

  await renderWithProviders(
    <GenerationOptionsFields {...baseProps()} optimizationPriorities={enabledBreaks} />,
  );

  await expect.element(page.getByText("Breaks per day")).toBeVisible();
});
