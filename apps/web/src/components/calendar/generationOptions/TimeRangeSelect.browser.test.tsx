import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { TimeRangeSelect } from "./TimeRangeSelect";
import { renderWithProviders } from "../../../test/renderWithProviders";

function baseProps() {
  return {
    minStartMinutes: 8 * 60 + 30, // 08:30
    maxEndMinutes: 22 * 60, // 22:00
    onMinStartMinutesChange: vi.fn(),
    onMaxEndMinutesChange: vi.fn(),
  };
}

test("shows the current window and picks a new earliest time from the popover", async () => {
  const props = baseProps();
  await renderWithProviders(<TimeRangeSelect {...props} />);

  const earliest = page.getByRole("button", { name: "Earliest class start" });
  await expect.element(earliest).toHaveTextContent("08:30");
  await expect
    .element(page.getByRole("button", { name: "Latest class end" }))
    .toHaveTextContent("22:00");

  await earliest.click();
  await page.getByRole("option", { name: "09:00" }).click();
  expect(props.onMinStartMinutesChange).toHaveBeenCalledWith(9 * 60);
});

test("picks a new latest time from the popover", async () => {
  const props = baseProps();
  await renderWithProviders(<TimeRangeSelect {...props} />);

  await page.getByRole("button", { name: "Latest class end" }).click();
  await page.getByRole("option", { name: "20:00" }).click();
  expect(props.onMaxEndMinutesChange).toHaveBeenCalledWith(20 * 60);
});
