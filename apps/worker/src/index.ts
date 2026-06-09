import { Hono } from "hono";
import { cors } from "hono/cors";
import { sendPushNotification } from "./webpush.js";
import { handleOgImage } from "./ogImage.js";
import { buildDonationSummary } from "./donations.js";
import { handleDonationEmail } from "./donationEmail.js";

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
}

const ALLOWED_ORIGINS = ["https://uoplan.party", "http://localhost:5173"];

async function endpointKey(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `sub:${Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`,
  });
  const data = await res.json<{ success: boolean }>();
  return data.success;
}

function buildShareHtml(stateBase64url: string, schedulePayload?: string | null): string {
  const base64 = stateBase64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const appUrl = `/schedule/calendar/?s=${encodeURIComponent(padded)}`;
  // The `p` payload (courses + sections of the already-generated schedule) lets
  // the OG-image worker render without re-running schedule generation. It is
  // only forwarded to the OG image; the redirect above uses the primary state.
  const ogQuery = schedulePayload ? `?p=${encodeURIComponent(schedulePayload)}` : "";
  const ogImage = `https://uoplan.party/api/og-image/${stateBase64url}${ogQuery}`;
  const ogUrl = `https://uoplan.party/api/share/${stateBase64url}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>uoplan – My Schedule</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="uoplan – My Schedule">
  <meta property="og:description" content="View my generated course schedule on uoplan.">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ogImage}">
</head>
<body>
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;
}

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

app.post("/api/subscribe", async (c) => {
  const sub = await c.req.json<{
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    "cf-turnstile-response"?: string;
  }>();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return c.json({ error: "Invalid subscription" }, 400);
  }
  const token = sub["cf-turnstile-response"];
  if (!token) return c.json({ error: "Missing Turnstile token" }, 400);
  const ip = c.req.header("CF-Connecting-IP") ?? "";
  if (!(await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip))) {
    return c.json({ error: "Turnstile verification failed" }, 403);
  }
  const key = await endpointKey(sub.endpoint);
  await c.env.WEBPUSH_SUBSCRIPTIONS.put(
    key,
    JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
  );
  return c.json({ ok: true }, 201);
});

app.post("/api/unsubscribe", async (c) => {
  const body = await c.req.json<{ endpoint?: string; "cf-turnstile-response"?: string }>();
  if (!body?.endpoint) return c.json({ error: "Missing endpoint" }, 400);
  const token = body["cf-turnstile-response"];
  if (!token) return c.json({ error: "Missing Turnstile token" }, 400);
  const ip = c.req.header("CF-Connecting-IP") ?? "";
  if (!(await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip))) {
    return c.json({ error: "Turnstile verification failed" }, 403);
  }
  await c.env.WEBPUSH_SUBSCRIPTIONS.delete(await endpointKey(body.endpoint));
  return c.json({ ok: true });
});

app.post("/api/send", async (c) => {
  if (c.req.header("Authorization") !== `Bearer ${c.env.NOTIFY_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await c.req.json<{ title?: string; body?: string; url?: string }>();
  if (!payload?.title || !payload?.body || !payload?.url) {
    return c.json({ error: "Missing required fields: title, body, url" }, 400);
  }
  const { title, body, url } = payload;

  let sent = 0,
    failed = 0,
    cleaned = 0;
  let cursor: string | undefined;
  let listComplete = false;

  while (!listComplete) {
    const list = await c.env.WEBPUSH_SUBSCRIPTIONS.list({ prefix: "sub:", cursor });
    cursor = (list as { cursor?: string }).cursor ?? undefined;
    listComplete = list.list_complete;

    await Promise.all(
      list.keys.map(async (kvKey) => {
        const subJson = await c.env.WEBPUSH_SUBSCRIPTIONS.get(kvKey.name);
        if (!subJson) return;
        const subscription = JSON.parse(subJson);
        try {
          await sendPushNotification(
            subscription,
            JSON.stringify({ title, body, url }),
            c.env.VAPID_SUBJECT,
            c.env.VAPID_PUBLIC_KEY,
            c.env.VAPID_PRIVATE_KEY,
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await c.env.WEBPUSH_SUBSCRIPTIONS.delete(kvKey.name);
            cleaned++;
          } else {
            failed++;
            console.error("Failed to send notification (status=%s):", status ?? "unknown", err);
          }
        }
      }),
    );
  }

  return c.json({ sent, failed, cleaned });
});

export default {
  fetch: app.fetch,
  email: handleDonationEmail,
};
