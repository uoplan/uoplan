// One-time (re-runnable) seed capture.
//
// Drives the REAL schedule page against the live dev server: adds a realistic
// basket of courses, generates a timetable, then reads the Share link the app
// produces and normalizes it into the `?s=` client-hydration param. The result
// is committed to seeds.json and replayed deterministically by every later
// capture — so we never re-drive the UI during a normal screenshot/video run.
//
// Usage:  node scripts/capture/capture-seed.mjs            (headless)
//         HEADED=1 node scripts/capture/capture-seed.mjs   (watch it drive)

import { openWeb, webUrl, gotoSettled } from "./lib/web.mjs";
import { loadWebSeeds, saveWebSeeds, SEED_BASKET } from "./seeds.mjs";
import { sleep } from "./lib/util.mjs";

/** base64url (from the share endpoint) → padded standard base64 (for `?s=`). */
function base64urlToBase64(b64url) {
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

async function addBasketCourse(page, code) {
  const box = page.getByPlaceholder("Add a course…");
  await box.click();
  await box.fill(code);
  await sleep(900);
  const option = page.getByRole("option").first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await sleep(300);
    return true;
  }
  await box.fill("");
  return false;
}

async function captureScheduleSeed() {
  const { browser, page } = await openWeb();
  try {
    await gotoSettled(page, webUrl("/schedule/"), { settleMs: 2000 });

    let added = 0;
    for (const code of SEED_BASKET) {
      if (await addBasketCourse(page, code)) added += 1;
    }
    if (added === 0) throw new Error("could not add any basket courses");

    await page
      .getByRole("button", { name: /Generate/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /Generate anyway/i })
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.getByTestId("calendar-page").waitFor({ state: "visible", timeout: 30_000 });
    await sleep(2500);

    await page.getByRole("button", { name: "Share", exact: true }).click();
    await sleep(500);
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    if (!shareUrl.includes("/api/share/")) throw new Error(`unexpected share url: ${shareUrl}`);
    const base64url = shareUrl.split("/api/share/")[1].split("?")[0];
    const sParam = base64urlToBase64(base64url);

    const seeds = loadWebSeeds();
    seeds.schedule = sParam;
    saveWebSeeds(seeds);
    console.log(
      `captured schedule seed from ${added} courses (${sParam.length} chars) → seeds.json`,
    );
  } finally {
    await browser.close();
  }
}

await captureScheduleSeed();
