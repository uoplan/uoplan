import { noopAnalytics } from "@uoplan/analytics";

import {
  createPostHogAnalyticsClient,
  getAnalytics,
  setCurrentAnalyticsClient,
} from "@/lib/analytics/client";
import { parseAnalyticsOptOut, serializeAnalyticsOptOut } from "@/lib/analytics/analytics-storage";

function fakePostHog() {
  return {
    capture: jest.fn(() => Promise.resolve()),
    screen: jest.fn(() => Promise.resolve()),
    optIn: jest.fn(() => Promise.resolve()),
    optOut: jest.fn(() => Promise.resolve()),
  };
}

describe("analytics opt-out storage helpers", () => {
  it("parses the persisted opt-out preference safely", () => {
    expect(parseAnalyticsOptOut('{"optedOut":true}')).toBe(true);
    expect(parseAnalyticsOptOut('{"optedOut":false}')).toBe(false);
    expect(parseAnalyticsOptOut("true")).toBe(true);
    expect(parseAnalyticsOptOut("false")).toBe(false);
    expect(parseAnalyticsOptOut('{"optedOut":"true"}')).toBe(false);
    expect(parseAnalyticsOptOut("not json")).toBe(false);
  });

  it("serializes the documented opt-out shape", () => {
    expect(JSON.parse(serializeAnalyticsOptOut(true))).toEqual({ optedOut: true });
    expect(JSON.parse(serializeAnalyticsOptOut(false))).toEqual({ optedOut: false });
  });
});

describe("PostHog analytics client facade", () => {
  it("captures typed events and screens only while opted in", () => {
    const posthog = fakePostHog();
    let optedOut = false;
    const client = createPostHogAnalyticsClient({
      posthog,
      isOptedOut: () => optedOut,
      setOptedOut: (next) => {
        optedOut = next;
      },
    });

    client.capture("basket_course_added", { courseCode: "CSI 2101" });
    client.capturePageview({ path: "/schedule" });
    optedOut = true;
    client.capture("basket_course_removed", { courseCode: "CSI 2101" });
    client.capturePageview({ path: "/explore" });

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("basket_course_added", {
      courseCode: "CSI 2101",
    });
    expect(posthog.screen).toHaveBeenCalledTimes(1);
    expect(posthog.screen).toHaveBeenCalledWith("/schedule", { path: "/schedule" });
  });

  it("persists opt-in/out through the supplied preference setter", async () => {
    const posthog = fakePostHog();
    let optedOut = false;
    const client = createPostHogAnalyticsClient({
      posthog,
      isOptedOut: () => optedOut,
      setOptedOut: (next) => {
        optedOut = next;
      },
    });

    client.optOut();
    expect(optedOut).toBe(true);
    expect(posthog.optOut).toHaveBeenCalledTimes(1);

    client.optIn();
    await Promise.resolve();

    expect(optedOut).toBe(false);
    expect(posthog.optIn).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("analytics_opted_in", {});
  });

  it("exposes a non-hook accessor for non-React call sites", () => {
    const posthog = fakePostHog();
    const client = createPostHogAnalyticsClient({
      posthog,
      isOptedOut: () => false,
      setOptedOut: jest.fn(),
    });

    setCurrentAnalyticsClient(client);
    expect(getAnalytics()).toBe(client);

    setCurrentAnalyticsClient(noopAnalytics);
  });
});
