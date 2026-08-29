import { expect, test } from "@playwright/test";

/**
 * Back-navigation labelling regression coverage.
 *
 * The shared BackButton always navigates to (and labels from) its caller's
 * logical parent route, never browser/router history. This is deliberate: a
 * deep link, a share link, an external referrer (e.g. a Google search result
 * landing directly on a professor page), and an in-app click must all back
 * out to the same predictable place. Uses committed `.pb` data so it is
 * deterministic without a network.
 */

test("personalize back button always names Home, regardless of how it was reached", async ({
  page,
}) => {
  // Fresh deep link: no in-app history at all.
  await page.goto("/personalize");
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();

  // Reached via an in-app navigation from an Explore search: the label is
  // still "Home" (Personalize's logical parent), not the search page.
  await page.goto("/explore?q=csi");
  const banner = page.locator('a[href="/personalize"]');
  await expect(banner).toBeVisible();
  await banner.click();
  await page.waitForURL(/\/personalize\/?(?:[?#]|$)/);
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
});

test("a professor page reached with no in-app history backs out to Course Explorer, not the referrer", async ({
  page,
}) => {
  // Find a real professor URL by drilling into a course page with known
  // grade/instructor data (professor links live on the course detail page's
  // teaching-history section, not the search results list).
  await page.goto("/explore/course/csi3140");
  const professorLink = page.locator('a[href*="/explore/professor/"]').first();
  await expect(professorLink).toBeVisible({ timeout: 15_000 });
  const href = await professorLink.getAttribute("href");

  // Simulates landing directly on that professor page from an external link
  // (e.g. a Google search result) — fresh navigation, no in-app history to pop.
  await page.goto(href ?? "/explore/professor/");

  const back = page.getByRole("button", { name: "Course explorer", exact: true });
  await expect(back).toBeVisible();
  await back.click();
  await page.waitForURL(/\/explore\/?(?:[?#]|$)/);
});
