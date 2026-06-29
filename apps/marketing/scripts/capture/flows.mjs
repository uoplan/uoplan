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
    (dur) =>
      new Promise((resolve) => {
        window.scrollTo(0, 0);
        const max = Math.max(0, document.body.scrollHeight - window.innerHeight) * 0.92;
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
    ms,
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
  // Explore: two quick searches (so it reads as "search anything"), then a
  // continuous browse that lasts the rest of the beat.
  async explore(page) {
    const search = page.getByPlaceholder(/Search/i).first();
    if (await search.isVisible().catch(() => false)) {
      await typeSlow(search, "eng", 110);
      await sleep(900);
      await search.fill("");
      await sleep(300);
      await typeSlow(search, "calc", 110);
      await sleep(900);
      await search.fill("");
      await sleep(400);
    }
    await scrollThrough(page, 5200);
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
