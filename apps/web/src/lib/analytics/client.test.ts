import { ANALYTICS_OPT_OUT_STORAGE_KEY, noopAnalytics } from "@uoplan/analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult, PostHog, PostHogConfig } from "posthog-js";
import {
  buildWebAnalyticsClient,
  readAnalyticsOptOutPreference,
  writeAnalyticsOptOutPreference,
} from "./client";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("web analytics client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the analytics opt-out preference as a localStorage flag", () => {
    expect(readAnalyticsOptOutPreference()).toBe(false);

    writeAnalyticsOptOutPreference(true);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe("1");
    expect(readAnalyticsOptOutPreference()).toBe(true);

    writeAnalyticsOptOutPreference(false);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe("0");
    expect(readAnalyticsOptOutPreference()).toBe(false);
  });

  it("returns the shared noop client when capture is disabled", () => {
    const client = buildWebAnalyticsClient({
      enabled: false,
      config: { key: "phc_test", host: "https://t.example", uiHost: "https://eu.posthog.com" },
    });

    expect(client).toBe(noopAnalytics);
  });

  it("configures PostHog to avoid sending full URLs", async () => {
    const init = vi.fn();
    buildWebAnalyticsClient({
      enabled: true,
      config: { key: "phc_test", host: "https://t.example", uiHost: "https://eu.posthog.com" },
      loadPostHog: async () =>
        ({
          capture: vi.fn(),
          init,
          opt_in_capturing: vi.fn(),
          opt_out_capturing: vi.fn(),
        }) as unknown as PostHog,
    });
    await flushPromises();

    const options = init.mock.calls[0]?.[1] as Partial<PostHogConfig>;
    expect(options.mask_personal_data_properties).toBe(true);
    expect(options.custom_personal_data_properties).toContain("q");
    expect(options.before_send).toBeTypeOf("function");

    const beforeSend = options.before_send as (
      captureResult: CaptureResult,
    ) => CaptureResult | null;
    const sanitized = beforeSend({
      uuid: "test",
      event: "explore_search",
      properties: {
        $current_url: "https://uoplan.party/explore?q=raw",
        $referrer: "https://search.example/?q=raw",
        path: "/explore",
      },
    });

    expect(sanitized?.properties).toEqual({ path: "/explore" });
  });
});
