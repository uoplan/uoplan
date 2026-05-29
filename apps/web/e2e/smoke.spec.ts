import { expect, test } from "@playwright/test";

/**
 * Smoke coverage: the landing page boots, renders its title, and exposes the
 * primary navigation tiles. This validates that the e2e harness (dev server +
 * committed `.pb` data) works end to end. The wizard → calendar happy path and
 * share-URL flows land in Phase 5 on top of this scaffold.
 */
test("landing page loads and shows the primary tiles", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/uoplan/i);

  // The three entry tiles are rendered as accessible links.
  await expect(page.getByRole("link", { name: /Schedule generator/i })).toBeVisible();
});
