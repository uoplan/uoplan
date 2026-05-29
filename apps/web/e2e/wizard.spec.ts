import { expect, test } from "@playwright/test";

/**
 * Wizard → calendar happy path.
 *
 * Drives the schedule dashboard to generation and asserts we land on the
 * calendar. Uses committed `.pb` data so it is deterministic without a network.
 * The dashboard lets the user generate even with outstanding blockers (via the
 * confirmation modal), so this path works without selecting a full program.
 */
test("generates from the dashboard and lands on the calendar", async ({ page }) => {
  await page.goto("/schedule");

  await expect(page.getByRole("heading", { name: /Build your schedule/i })).toBeVisible();

  await page.getByRole("button", { name: "Generate", exact: true }).click();

  // With no program selected there are blockers, so the confirmation modal opens.
  await page.getByRole("button", { name: "Generate anyway" }).click();

  await page.waitForURL("**/schedule/calendar");
  await expect(page.getByTestId("calendar-page")).toBeVisible();
});
