import { expect, test } from "@playwright/test";

/**
 * Back-navigation labelling regression coverage.
 *
 * The shared BackButton derives its label purely from the globally-tracked
 * previous location (URL + query), so arriving at a page via an in-app
 * navigation names where the user actually came from — not a hard-coded parent.
 * Uses committed `.pb` data so it is deterministic without a network.
 */

test("personalize back button names the explore search the user came from", async ({ page }) => {
  await page.goto("/explore?q=csi");

  // The floating personalize nudge is the only link to /personalize on the
  // explore page (shown while the user has not set a program / completed courses).
  const banner = page.locator('a[href="/personalize"]');
  await expect(banner).toBeVisible();
  await banner.click();

  await page.waitForURL(/\/personalize\/?(?:[?#]|$)/);

  // The back affordance reflects the tracked previous page (the explore search),
  // derived from its URL + query alone — not a generic "Home".
  await expect(
    page.getByRole("button", { name: 'Search results for "csi"', exact: true }),
  ).toBeVisible();
});

test("personalize back button falls back to Home on a fresh deep link", async ({ page }) => {
  // No in-app history to pop, so the label falls back to the logical parent ("/").
  await page.goto("/personalize");

  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
});
