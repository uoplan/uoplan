import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AnalyticsClient } from "@uoplan/analytics";
import { getAnalytics, initializeAnalytics } from "./client";
import { AnalyticsContext } from "./context";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<AnalyticsClient>(() => getAnalytics());

  useEffect(() => {
    const initialPath = typeof window !== "undefined" ? window.location.pathname : undefined;
    setClient(initializeAnalytics(initialPath ? { path: initialPath } : undefined));
  }, []);

  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}
