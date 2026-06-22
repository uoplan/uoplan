import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTHOG_HOST,
  DEFAULT_POSTHOG_KEY,
  DEFAULT_POSTHOG_UI_HOST,
  resolveAnalyticsConfig,
  shouldEnableCapture,
} from "./config";
import { noopAnalytics } from "./types";

describe("resolveAnalyticsConfig", () => {
  it("falls back to the committed defaults when no overrides are given", () => {
    expect(resolveAnalyticsConfig()).toEqual({
      key: DEFAULT_POSTHOG_KEY,
      host: DEFAULT_POSTHOG_HOST,
      uiHost: DEFAULT_POSTHOG_UI_HOST,
    });
  });

  it("uses non-empty overrides and ignores blank/whitespace ones", () => {
    expect(resolveAnalyticsConfig({ key: "phc_custom", host: "  ", uiHost: undefined })).toEqual({
      key: "phc_custom",
      host: DEFAULT_POSTHOG_HOST,
      uiHost: DEFAULT_POSTHOG_UI_HOST,
    });
  });

  it("trims surrounding whitespace from overrides", () => {
    expect(resolveAnalyticsConfig({ host: " https://t.example.com " }).host).toBe(
      "https://t.example.com",
    );
  });
});

describe("shouldEnableCapture", () => {
  it("is disabled without a key", () => {
    expect(shouldEnableCapture({ key: "", isProduction: true })).toBe(false);
  });

  it("is enabled in production with a key", () => {
    expect(shouldEnableCapture({ key: "phc_x", isProduction: true })).toBe(true);
  });

  it("is disabled outside production unless debug is set", () => {
    expect(shouldEnableCapture({ key: "phc_x", isProduction: false })).toBe(false);
    expect(shouldEnableCapture({ key: "phc_x", isProduction: false, debug: true })).toBe(true);
  });
});

describe("noopAnalytics", () => {
  it("never throws and reports opted-in", () => {
    expect(() => {
      noopAnalytics.capture("trends_viewed");
      noopAnalytics.capture("term_selected", { termCode: "2271" });
      noopAnalytics.capturePageview({ path: "/" });
      noopAnalytics.optIn();
      noopAnalytics.optOut();
    }).not.toThrow();
    expect(noopAnalytics.isOptedOut()).toBe(false);
  });
});
