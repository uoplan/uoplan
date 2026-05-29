import { expect, test } from "@playwright/test";

/**
 * Share-link round trip.
 *
 * Selects a program (any available year + program) so the calendar opens in
 * advanced mode where the Share control is exposed, copies the share link, then
 * opens that link in the same page and asserts the calendar re-hydrates. This
 * exercises share-URL encoding and decoding end to end against committed data.
 */
test("copies a share link and re-hydrates the calendar from it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/schedule/program");

  // Pick the first available "first year of study".
  await page.getByRole("combobox", { name: "First year of study" }).click();
  await page.getByRole("option").first().click();

  // The program list loads from the year catalogue; pick the first program.
  const programInput = page.getByRole("combobox", { name: "Select your program" });
  await expect(programInput).toBeEnabled();
  await programInput.click();
  const firstProgram = page.getByRole("option").first();
  await expect(firstProgram).toBeVisible();
  await firstProgram.click();

  // Back to the dashboard and generate (blockers may remain → confirm modal).
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const generateAnyway = page.getByRole("button", { name: "Generate anyway" });
  await generateAnyway.click({ timeout: 5000 }).catch(() => {});

  await page.waitForURL("**/schedule/calendar");
  await expect(page.getByTestId("calendar-page")).toBeVisible();

  // The dashboard generate produced a "not enough courses" notice (expected with
  // no completed courses). Clearing it would just re-trigger generation, so leave
  // it open and dispatch the share click directly, bypassing the overlay.
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Share" }).dispatchEvent("click");

  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toMatch(/^https?:\/\/.+\/api\/share\/.+/);

  // The share link is a worker OG-unfurl endpoint (`/api/share/:state`) that
  // redirects to the client hydration route. The vite dev server doesn't run the
  // worker, so derive that client URL directly the same way the worker does.
  const stateBase64url = shareUrl.split("/api/share/")[1];
  const base64 = stateBase64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const clientUrl = `/schedule/calendar/?s=${encodeURIComponent(padded)}`;

  // Re-hydrate from the shared link (decodes state, loads data, routes to calendar).
  await page.goto(clientUrl);
  await expect(page.getByTestId("calendar-page")).toBeVisible({ timeout: 20_000 });
});
