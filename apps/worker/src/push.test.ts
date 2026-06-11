import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { sendPushNotification } from "./webpush.js";
import type { Env } from "./index.js";

vi.mock("./ogImage.js", () => ({
  handleOgImage: vi.fn(),
}));

vi.mock("./webpush.js", () => ({
  sendPushNotification: vi.fn(),
}));

type StoredSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

function makeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async ({ prefix }: { prefix?: string; cursor?: string } = {}) => ({
      keys: Array.from(store.keys())
        .filter((name) => !prefix || name.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    })),
    store,
  };
}

function makeEnv(initialSubscriptions?: Record<string, string>): Env {
  return {
    WEBPUSH_SUBSCRIPTIONS: makeKv(initialSubscriptions),
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NOTIFY_SECRET: "notify-secret",
    VAPID_SUBJECT: "mailto:admin@uoplan.party",
    VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
  } as unknown as Env;
}

async function post(
  path: string,
  body: unknown,
  env: Env,
  headers?: Record<string, string>,
): Promise<Response> {
  return worker.fetch(
    new Request(`https://uoplan.party${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    env,
  );
}

function subscription(endpoint = "https://push.example/sub/1"): StoredSubscription {
  return { endpoint, keys: { p256dh: "p256dh-key", auth: "auth-key" } };
}

async function json(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(() => {
  vi.mocked(sendPushNotification).mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
  );
});

describe("push subscription routes", () => {
  it("rejects subscriptions without endpoint and keys", async () => {
    const env = makeEnv();
    const res = await post("/api/subscribe", { endpoint: "https://push.example/sub/1" }, env);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "Invalid subscription" });
    expect(env.WEBPUSH_SUBSCRIPTIONS.put).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires a Turnstile token before storing a subscription", async () => {
    const env = makeEnv();
    const res = await post("/api/subscribe", subscription(), env);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "Missing Turnstile token" });
    expect(env.WEBPUSH_SUBSCRIPTIONS.put).not.toHaveBeenCalled();
  });

  it("rejects subscriptions when Turnstile verification fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    const env = makeEnv();
    const res = await post(
      "/api/subscribe",
      { ...subscription(), "cf-turnstile-response": "bad-token" },
      env,
      { "CF-Connecting-IP": "203.0.113.7" },
    );

    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({ error: "Turnstile verification failed" });
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: "secret=turnstile-secret&response=bad-token&remoteip=203.0.113.7",
      }),
    );
    expect(env.WEBPUSH_SUBSCRIPTIONS.put).not.toHaveBeenCalled();
  });

  it("stores a verified subscription under a stable hashed endpoint key", async () => {
    const env = makeEnv();
    const sub = subscription("https://push.example/sub/verified");
    const res = await post(
      "/api/subscribe",
      { ...sub, "cf-turnstile-response": "good-token", extra: "ignored" },
      env,
    );

    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({ ok: true });
    expect(env.WEBPUSH_SUBSCRIPTIONS.put).toHaveBeenCalledWith(
      expect.stringMatching(/^sub:[a-f0-9]{64}$/),
      JSON.stringify(sub),
    );
  });

  it("deletes a verified subscription by hashed endpoint key", async () => {
    const env = makeEnv();
    const res = await post(
      "/api/unsubscribe",
      {
        endpoint: "https://push.example/sub/verified",
        "cf-turnstile-response": "good-token",
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
    expect(env.WEBPUSH_SUBSCRIPTIONS.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^sub:[a-f0-9]{64}$/),
    );
  });
});

describe("push send route", () => {
  it("requires the notify bearer token", async () => {
    const env = makeEnv();
    const res = await post("/api/send", { title: "New term", body: "Fall is live", url: "/" }, env);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: "Unauthorized" });
    expect(env.WEBPUSH_SUBSCRIPTIONS.list).not.toHaveBeenCalled();
  });

  it("requires title, body, and url", async () => {
    const env = makeEnv();
    const res = await post("/api/send", { title: "New term", body: "Fall is live" }, env, {
      Authorization: "Bearer notify-secret",
    });

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "Missing required fields: title, body, url" });
    expect(env.WEBPUSH_SUBSCRIPTIONS.list).not.toHaveBeenCalled();
  });

  it("sends to stored subscriptions, cleans stale endpoints, and counts other failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const active = subscription("https://push.example/sub/active");
    const stale = subscription("https://push.example/sub/stale");
    const failing = subscription("https://push.example/sub/failing");
    vi.mocked(sendPushNotification).mockImplementation(async (sub: StoredSubscription) => {
      if (sub.endpoint.endsWith("/stale")) {
        const err = new Error("gone");
        (err as { statusCode?: number }).statusCode = 410;
        throw err;
      }
      if (sub.endpoint.endsWith("/failing")) {
        const err = new Error("service unavailable");
        (err as { statusCode?: number }).statusCode = 503;
        throw err;
      }
    });
    const env = makeEnv({
      "sub:active": JSON.stringify(active),
      "sub:stale": JSON.stringify(stale),
      "sub:failing": JSON.stringify(failing),
    });

    const res = await post(
      "/api/send",
      { title: "New term", body: "Fall is live", url: "https://uoplan.party" },
      env,
      { Authorization: "Bearer notify-secret" },
    );

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ sent: 1, failed: 1, cleaned: 1 });
    expect(sendPushNotification).toHaveBeenCalledWith(
      active,
      JSON.stringify({ title: "New term", body: "Fall is live", url: "https://uoplan.party" }),
      "mailto:admin@uoplan.party",
      "public-key",
      "private-key",
    );
    expect(env.WEBPUSH_SUBSCRIPTIONS.delete).toHaveBeenCalledWith("sub:stale");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
