// Scripted app-flow gestures for the ad's on-screen footage.
//
// Each flow drives one feature beat with deliberate, camera-friendly motion
// (focus, type, scroll, expand, cycle) so the recorded clip reads clearly when
// mapped onto a 3D device screen. Flows are intentionally slow and smooth — the
// ad cuts between them, it doesn't need frantic interaction.

import { sleep } from "./lib/util.mjs";

/** Smoothly scroll the window to an absolute Y over `ms`, easing in/out. */
async function smoothScrollTo(page, targetY, ms = 1800) {
  await page.evaluate(
    ([y, dur]) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        const dist = y - startY;
        const t0 = performance.now();
        const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          window.scrollTo(0, startY + dist * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      }),
    [targetY, ms],
  );
  await sleep(ms + 150);
}

/** Type into an element character-by-character so the keystrokes are visible. */
async function typeSlow(locator, text, perKey = 120) {
  await locator.click();
  await sleep(250);
  await locator.pressSequentially(text, { delay: perKey });
}

const FLOWS = {
  // Explore: search the catalogue, watch results filter, swap query, browse.
  async explore(page) {
    await sleep(700);
    const search = page.getByPlaceholder(/Search/i).first();
    if (await search.isVisible().catch(() => false)) {
      await typeSlow(search, "csi");
      await sleep(1100);
      await search.click();
      await page.keyboard.press("Meta+A");
      await page.keyboard.press("Backspace");
      await sleep(500);
      await typeSlow(search, "eng");
      await sleep(1200);
    }
    // Stay near the top — only a short browse, never reaching the footer.
    await smoothScrollTo(page, 420, 1800);
    await sleep(900);
  },

  // Trends: a small reveal of the decade chart + discipline cards (never the footer).
  async trends(page) {
    await sleep(1000);
    await smoothScrollTo(page, 160, 2200);
    await sleep(900);
    await smoothScrollTo(page, 360, 2000);
    await sleep(900);
  },

  // Schedule: reveal the generated week, then cycle through alternatives.
  async schedule(page) {
    await sleep(1200);
    const next = page.getByRole("button", { name: /Next/i }).first();
    for (let i = 0; i < 4; i += 1) {
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => {});
        await sleep(1600);
      }
    }
  },

  // Customize: open the basket/options and tweak the plan.
  async customize(page) {
    await sleep(900);
    // Cycle a couple of alternatives, then scroll the options rail.
    const next = page.getByRole("button", { name: /Next/i }).first();
    if (await next.isVisible().catch(() => false)) {
      await next.click().catch(() => {});
      await sleep(1400);
    }
    await smoothScrollTo(page, 900, 2200);
    await sleep(1000);
    await smoothScrollTo(page, 1700, 2200);
    await sleep(900);
  },
};

export async function runFlow(id, page) {
  const flow = FLOWS[id];
  if (!flow) throw new Error(`unknown flow: ${id}`);
  await flow(page);
}
