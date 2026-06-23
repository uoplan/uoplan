import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { DayAvoidToggles } from "./DayAvoidToggles";
import { renderWithProviders } from "../../../test/renderWithProviders";

test("marks avoided days as pressed and toggles them on click", async () => {
  const onAvoidedDaysChange = vi.fn();

  await renderWithProviders(
    <DayAvoidToggles avoidedDays={["Sa", "Su"]} onAvoidedDaysChange={onAvoidedDaysChange} />,
  );

  await expect
    .element(page.getByRole("button", { name: "Saturday" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect
    .element(page.getByRole("button", { name: "Monday" }))
    .toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Monday" }).click();
  expect(onAvoidedDaysChange).toHaveBeenCalledWith(["Su", "Mo", "Sa"]);
});

test("clicking an already-avoided day removes it from the set", async () => {
  const onAvoidedDaysChange = vi.fn();

  await renderWithProviders(
    <DayAvoidToggles avoidedDays={["Sa", "Su"]} onAvoidedDaysChange={onAvoidedDaysChange} />,
  );

  await page.getByRole("button", { name: "Saturday" }).click();
  expect(onAvoidedDaysChange).toHaveBeenCalledWith(["Su"]);
});
