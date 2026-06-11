import { describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { buildDonationSummary, TOTAL_CENTS_KEY } from "./donations.js";
import type { Env } from "./index.js";

vi.mock("./ogImage.js", () => ({
  handleOgImage: vi.fn(),
}));

function makeEnv(opts: {
  cachedTotal?: string | null;
  d1Total?: number;
  goal?: string;
  currency?: string;
  reason?: string;
}): Env {
  const get = vi.fn(async () => opts.cachedTotal ?? null);
  const put = vi.fn(async () => {});
  const first = vi.fn(async () => ({ total: opts.d1Total ?? 0 }));
  const prepare = vi.fn(() => ({ first }));
  return {
    DONATIONS: { get, put },
    DONATIONS_DB: { prepare },
    DONATION_GOAL_CENTS: opts.goal ?? "100000",
    DONATION_CURRENCY: opts.currency ?? "CAD",
    DONATION_REASON: opts.reason,
  } as unknown as Env;
}

describe("buildDonationSummary", () => {
  it("uses the cached KV total and omits blank donation reasons", async () => {
    const env = makeEnv({ cachedTotal: "2500", d1Total: 9999, reason: "   " });

    const summary = await buildDonationSummary(env);

    expect(summary).toMatchObject({ goalCents: 100000, totalCents: 2500, currency: "CAD" });
    expect(summary).not.toHaveProperty("reason");
    expect(env.DONATIONS_DB.prepare).not.toHaveBeenCalled();
    expect(env.DONATIONS.put).not.toHaveBeenCalled();
    expect(Date.parse(summary.updatedAt)).not.toBeNaN();
  });

  it("recomputes and backfills the total when KV is missing", async () => {
    const env = makeEnv({
      cachedTotal: null,
      d1Total: 7250,
      goal: "20000",
      reason: "Hosting costs",
    });

    const summary = await buildDonationSummary(env);

    expect(env.DONATIONS_DB.prepare).toHaveBeenCalledWith(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM donations",
    );
    expect(env.DONATIONS.put).toHaveBeenCalledWith(TOTAL_CENTS_KEY, "7250");
    expect(summary).toMatchObject({
      goalCents: 20000,
      totalCents: 7250,
      currency: "CAD",
      reason: "Hosting costs",
    });
  });

  it("falls back to D1 when the KV total is not a finite integer", async () => {
    const env = makeEnv({
      cachedTotal: "not-a-number",
      d1Total: 3400,
      goal: "invalid",
      currency: "USD",
    });

    const summary = await buildDonationSummary(env);

    expect(env.DONATIONS.put).toHaveBeenCalledWith(TOTAL_CENTS_KEY, "3400");
    expect(summary).toMatchObject({ goalCents: 0, totalCents: 3400, currency: "USD" });
  });
});

describe("donations route", () => {
  it("returns the summary JSON with a short public cache header", async () => {
    const env = makeEnv({ cachedTotal: "12345", goal: "50000", reason: "Server bills" });

    const res = await worker.fetch(new Request("https://uoplan.party/api/donations"), env);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(body).toMatchObject({
      goalCents: 50000,
      totalCents: 12345,
      currency: "CAD",
      reason: "Server bills",
    });
    expect(typeof body.updatedAt).toBe("string");
  });
});
