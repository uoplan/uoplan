import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/**
 * Writes the running page's Istanbul accumulator (`window.__coverage__`) to
 * `apps/web/.nyc_output/` so the dead-code report can merge it. Each full
 * `page.goto` starts a fresh JS realm, so call this after exercising each route
 * (before navigating away). Snapshots are cumulative per realm — for the
 * 0-hit/dead signal the merge double-count is irrelevant.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const nycDir = path.resolve(here, "..", ".nyc_output");

export async function dumpCoverage(page: Page, label: string): Promise<void> {
  const cov = await page.evaluate(() => (window as { __coverage__?: unknown }).__coverage__);
  if (!cov) return;
  fs.mkdirSync(nycDir, { recursive: true });
  const safe = label.replaceAll(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  fs.writeFileSync(path.join(nycDir, `e2e-${safe}.json`), JSON.stringify(cov));
}
