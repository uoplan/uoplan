import type { Env } from "./index.js";

export const TOTAL_CENTS_KEY = "total_cents";

export interface DonationSummary {
  goalCents: number;
  totalCents: number;
  currency: string;
  updatedAt: string;
}

/**
 * Returns the running donation total in integer cents. The KV value is the fast
 * path; if it is missing (e.g. first run or after a KV reset) we recompute the
 * authoritative sum from D1 and backfill KV.
 */
export async function getDonationTotalCents(env: Env): Promise<number> {
  const cached = await env.DONATIONS.get(TOTAL_CENTS_KEY);
  if (cached !== null) {
    const parsed = Number.parseInt(cached, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const total = await sumDonationsFromD1(env);
  await env.DONATIONS.put(TOTAL_CENTS_KEY, String(total));
  return total;
}

export async function sumDonationsFromD1(env: Env): Promise<number> {
  const row = await env.DONATIONS_DB.prepare(
    "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM donations",
  ).first<{ total: number }>();
  return row?.total ?? 0;
}

export async function buildDonationSummary(env: Env): Promise<DonationSummary> {
  const goalCents = Number.parseInt(env.DONATION_GOAL_CENTS ?? "0", 10) || 0;
  const totalCents = await getDonationTotalCents(env);
  return {
    goalCents,
    totalCents,
    currency: env.DONATION_CURRENCY ?? "CAD",
    updatedAt: new Date().toISOString(),
  };
}
