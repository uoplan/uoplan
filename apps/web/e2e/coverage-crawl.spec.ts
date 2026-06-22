import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { dumpCoverage } from "./_coverage-util";

/**
 * Runtime-coverage crawl (runs only under playwright.coverage.config.ts against
 * the COVERAGE=1 instrumented server on port 5274). Visits every static route +
 * drives the explore search to drill into dynamic detail pages, dumping
 * `window.__coverage__` after each so the dead-code report has automated
 * baseline coverage. This is NOT a correctness test — failures are swallowed so
 * a single flaky route can't abort the crawl. It is deliberately broad, not
 * exhaustive: a thorough manual walk still finds more, and worker-thread code
 * (e.g. the schedule engine in src/workers) is invisible to this main-thread
 * coverage entirely.
 */

const STATIC_ROUTES: Array<[string, string]> = [
  ["/", "landing"],
  ["/explore", "explore"],
  ["/trends", "trends"],
  ["/trends/leaderboard", "trends-leaderboard"],
  ["/trends/courses", "trends-courses"],
  ["/trends/disciplines", "trends-disciplines"],
  ["/trends/feedback", "trends-feedback"],
  ["/graph", "graph"],
  ["/changelog", "changelog"],
  ["/donate", "donate"],
  ["/privacy", "privacy"],
  ["/terms", "terms"],
  ["/personalize", "personalize"],
];

test.describe.configure({ mode: "serial" });

async function visit(page: Page, url: string, label: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(500);
    await dumpCoverage(page, label);
    return true;
  } catch {
    await dumpCoverage(page, `${label}-partial`).catch(() => {});
    return false;
  }
}

async function firstHref(page: Page, selector: string): Promise<string | null> {
  return page
    .locator(selector)
    .first()
    .getAttribute("href", { timeout: 4_000 })
    .catch(() => null);
}

test("crawl static routes", async ({ page }) => {
  for (const [route, label] of STATIC_ROUTES) {
    await visit(page, route, label);
  }
});

test("personalize → generate → schedule", async ({ page }) => {
  try {
    await page.goto("/personalize", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("button", { name: "Generate", exact: true }).click({ timeout: 10_000 });
    await page
      .getByRole("button", { name: "Generate anyway" })
      .click({ timeout: 5_000 })
      .catch(() => {});
    await page.waitForURL(/\/schedule\/?(?:[?#]|$)/, { timeout: 30_000 });
    await page.waitForTimeout(1_000);
    await dumpCoverage(page, "schedule");
  } catch {
    await dumpCoverage(page, "schedule-partial").catch(() => {});
  }
});

test("explore search → course / professor / discipline / faculty detail", async ({ page }) => {
  test.setTimeout(180_000);
  // Surface results by typing a common discipline code into the search box.
  try {
    await page.goto("/explore", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("textbox").first().fill("CSI", { timeout: 10_000 });
    await page.waitForTimeout(1_500);
  } catch {
    /* search box may differ; detail links may still be present */
  }

  // Drill into the first course result, then hop to its code-split sub-routes.
  const courseHref = await firstHref(page, 'a[href*="/explore/course/"]');
  if (courseHref) {
    const base = courseHref.replace(/\/$/, "");
    await visit(page, courseHref, "course-detail");
    await visit(page, `${base}/feedback`, "course-feedback");
    await visit(page, `${base}/schedule`, "course-schedule");

    // From the course page, professors / disciplines / faculties are linked.
    await page.goto(courseHref, { waitUntil: "domcontentloaded" }).catch(() => {});
    for (const [seg, label] of [
      ["professor", "professor-detail"],
      ["discipline", "discipline-detail"],
      ["faculty", "faculty-detail"],
    ] as const) {
      const href = await firstHref(page, `a[href*="/explore/${seg}/"]`);
      if (href) await visit(page, href, label);
    }
  }

  // Professor feedback sub-route, if we reached a professor link anywhere.
  const profHref = await firstHref(page, 'a[href*="/explore/professor/"]');
  if (profHref) {
    await visit(page, `${profHref.replace(/\/$/, "")}/feedback`, "professor-feedback");
  }

  expect(true).toBe(true);
});
