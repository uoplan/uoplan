import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleOgImage } from "./ogImage.js";
import { buildDonationSummary } from "./donations.js";
import { handleDonationEmail } from "./donationEmail.js";
import { buildShareHtml } from "./share.js";
import { registerPushRoutes } from "./push.js";

export interface Env {
  ASSETS: Fetcher;
  WEBPUSH_SUBSCRIPTIONS: KVNamespace;
  DONATIONS: KVNamespace;
  DONATIONS_DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  NOTIFY_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  DONATION_GOAL_CENTS: string;
  DONATION_CURRENCY: string;
  DONATION_EMAIL: string;
  DONATION_REASON?: string;
  FORWARD_EMAIL: string;
}

const ALLOWED_ORIGINS = ["https://uoplan.party", "http://localhost:5173"];

const app = new Hono<{ Bindings: Env }>();

app.get("/api/share/:state", (c) => {
  const state = c.req.param("state");
  const schedulePayload = c.req.query("p");
  return c.html(buildShareHtml(state, schedulePayload));
});

app.get("/api/og-image/:state", async (c) => {
  const state = c.req.param("state");
  const schedulePayload = c.req.query("p");
  const origin = new URL(c.req.url).origin;
  return handleOgImage(state, schedulePayload, c.env, origin);
});

app.use(
  "/api/*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]),
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/api/donations", async (c) => {
  const summary = await buildDonationSummary(c.env);
  c.header("Cache-Control", "public, max-age=60");
  return c.json(summary);
});

registerPushRoutes(app);

export default {
  fetch: app.fetch,
  email: handleDonationEmail,
};
