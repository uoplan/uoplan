import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Automated accessibility coverage.
 *
 * Runs axe-core against the primary routes and fails on any `critical` or
 * `serious` violation. Lower-impact (`moderate`/`minor`) findings are reported
 * but don't fail the build yet. Rule ids listed in `KNOWN_ISSUES` are temporarily
 * exempted so the suite can be adopted without a big-bang cleanup — remove ids
 * from the set as the underlying issues are fixed so coverage ratchets up.
 *
 * Uses committed `.pb` data so the routes render deterministically without a
 * network (same harness as the other e2e specs).
 */

/** Rule ids exempted for now. Empty = every critical/serious rule is enforced.
 *  Remove ids as the underlying issues are fixed so coverage ratchets up. */
const KNOWN_ISSUES = new Set<string>([]);

const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

const ROUTES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "home", path: "/" },
  { name: "schedule", path: "/schedule" },
  { name: "explore", path: "/explore" },
  { name: "graph", path: "/graph" },
  { name: "trends", path: "/trends" },
];

async function analyzeRoute(page: Page) {
  return (
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The professor network renders to a <canvas> (sigma), which axe cannot
      // introspect; its accessible alternative is asserted separately.
      .exclude("canvas")
      .analyze()
  );
}

for (const route of ROUTES) {
  test(`a11y: ${route.name} has no critical/serious axe violations`, async ({ page }) => {
    await page.goto(route.path);
    // Let the SPA hydrate and the route's data load before scanning.
    await page.waitForLoadState("networkidle");

    const results = await analyzeRoute(page);

    const blocking = results.violations.filter(
      (v) => BLOCKING_IMPACTS.has(v.impact ?? "") && !KNOWN_ISSUES.has(v.id),
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  • [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
        .join("\n");
      console.error(`Accessibility violations on ${route.path}:\n${summary}`);
    }

    expect(blocking, blocking.map((v) => v.id).join(", ")).toEqual([]);
  });
}
