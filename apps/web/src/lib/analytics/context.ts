import { createContext, useContext } from "react";
import { noopAnalytics } from "@uoplan/analytics";
import type { AnalyticsClient } from "@uoplan/analytics";

export const AnalyticsContext = createContext<AnalyticsClient>(noopAnalytics);

export function useAnalytics(): AnalyticsClient {
  return useContext(AnalyticsContext);
}
