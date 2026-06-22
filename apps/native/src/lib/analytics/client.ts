import { noopAnalytics, type AnalyticsClient, type PageviewProperties } from "@uoplan/analytics";

export interface PostHogAnalyticsTarget {
  capture(event: string, properties?: Record<string, unknown>): unknown;
  screen(name: string, properties?: Record<string, unknown>): unknown;
  optIn(): unknown;
  optOut(): unknown;
}

let currentAnalyticsClient: AnalyticsClient = noopAnalytics;

function emptyProps(): Record<string, never> {
  return {};
}

export function createPostHogAnalyticsClient({
  posthog,
  isOptedOut,
  setOptedOut,
}: {
  posthog: PostHogAnalyticsTarget;
  isOptedOut: () => boolean;
  setOptedOut: (optedOut: boolean) => void;
}): AnalyticsClient {
  return {
    capture(event, props) {
      if (isOptedOut()) return;
      void posthog.capture(event, (props ?? emptyProps()) as Record<string, unknown>);
    },

    capturePageview(properties?: PageviewProperties) {
      if (isOptedOut()) return;
      const path = properties?.path ?? "unknown";
      void posthog.screen(path, { ...properties, path });
    },

    optIn() {
      setOptedOut(false);
      void Promise.resolve(posthog.optIn()).then(() => {
        void posthog.capture("analytics_opted_in", {});
      });
    },

    optOut() {
      setOptedOut(true);
      void posthog.optOut();
    },

    isOptedOut,
  };
}

export function setCurrentAnalyticsClient(client: AnalyticsClient): void {
  currentAnalyticsClient = client;
}

export function getAnalytics(): AnalyticsClient {
  return currentAnalyticsClient;
}
