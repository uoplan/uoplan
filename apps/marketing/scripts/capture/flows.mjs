// Scripted app-flow gestures for the ad's on-screen footage.
//
// Each flow drives one feature beat with deliberate, camera-friendly motion
// (focus, type, scroll, expand, cycle) so the recorded clip reads clearly when
// mapped onto a 3D device screen. Flows are intentionally slow and smooth — the
// ad cuts between them, it doesn't need frantic interaction.

import { sleep } from "./lib/util.mjs";

/** Continuously scroll from top to ~bottom over the whole beat, easing, so the
 *  page is always moving (no stop-and-sit at the bottom). */
async function scrollThrough(page, ms = 6000, frac = 0.92) {
  await page.evaluate(
    ([dur, fr]) =>
      new Promise((resolve) => {
        window.scrollTo(0, 0);
        const max = Math.max(0, document.body.scrollHeight - window.innerHeight) * fr;
        const t0 = performance.now();
        const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          window.scrollTo(0, max * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      }),
    [ms, frac],
  );
  await sleep(120);
}

/** Type into an element character-by-character so the keystrokes are visible. */
async function typeSlow(locator, text, perKey = 120) {
  await locator.click();
  await sleep(250);
  await locator.pressSequentially(text, { delay: perKey });
}

const FLOWS = {
  // Explore: one search that resolves to a course, open it, browse the professor
  // list, then click through to that course's satisfaction (feedback) page — a
  // real "search → drill in → read reviews" browse, not two throwaway searches.
  // Kept tight: the laptop screen shows the clip's first ~7s (no device spin), so
  // every beat has to land quickly.
  async explore(page) {
    const search = page.getByPlaceholder(/Search/i).first();
    if (await search.isVisible().catch(() => false)) {
      await typeSlow(search, "psy 1101", 95);
      await sleep(1100); // dwell on the live results so they read
    }
    // Open the top course result (PSY 1101 — a big multi-professor course).
    const course = page.locator('a[href*="/explore/course/"]').first();
    if (await course.isVisible().catch(() => false)) {
      await course.click().catch(() => {});
      await page.waitForURL(/\/explore\/course\//, { timeout: 4000 }).catch(() => {});
      await sleep(1400); // dwell on the course header + evaluations card
    }
    // Expand the top professor to reveal the per-term grade breakdown.
    const prof = page.getByRole("button", { name: /Brenda Baird/i }).first();
    if (await prof.isVisible().catch(() => false)) {
      await prof.click().catch(() => {});
      await sleep(1900); // dwell on the expanded breakdown
    }
    // Scroll slowly down the professor list (more profs + grade charts).
    await scrollThrough(page, 3000, 0.42);
    await sleep(500);
    // Click through to the course's satisfaction / student-evaluations page.
    // Hover first so TanStack Router preloads the route data (defaultPreload:
    // "intent") — the click then navigates instantly with no blank flash.
    const feedback = page.locator('a[href$="/feedback"]').first();
    if (await feedback.isVisible().catch(() => false)) {
      await feedback.hover().catch(() => {});
      await sleep(700);
      await feedback.click().catch(() => {});
      await page.waitForURL(/\/feedback/, { timeout: 4000 }).catch(() => {});
      await sleep(1300); // dwell on the satisfaction summary
    }
    // Ease slowly through just the top of the satisfaction charts — the overall
    // sentiment + first survey trends tell the story; no need to reach the bottom.
    await scrollThrough(page, 3400, 0.3);
    await sleep(500);
  },

  // Trends: one slow, continuous reveal of the dashboard across the whole beat.
  async trends(page) {
    await scrollThrough(page, 6400);
  },

  // Schedule: reveal the generated week, then cycle alternatives through the beat.
  async schedule(page) {
    await sleep(800);
    const next = page.getByRole("button", { name: /Next/i }).first();
    for (let i = 0; i < 4; i += 1) {
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => {});
        await sleep(1500);
      }
    }
  },

  // Customize: open options and tweak, then scroll the rail continuously.
  async customize(page) {
    const next = page.getByRole("button", { name: /Next/i }).first();
    if (await next.isVisible().catch(() => false)) {
      await next.click().catch(() => {});
      await sleep(900);
    }
    await scrollThrough(page, 6000);
  },
};

export async function runFlow(id, page) {
  const flow = FLOWS[id];
  if (!flow) throw new Error(`unknown flow: ${id}`);
  await flow(page);
}
