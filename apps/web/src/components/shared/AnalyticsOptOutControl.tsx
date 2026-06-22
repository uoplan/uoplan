import { Switch } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTr } from "../../i18n";
import {
  readAnalyticsOptOutPreference,
  useAnalytics,
  writeAnalyticsOptOutPreference,
} from "../../lib/analytics";

/**
 * Compact opt-out toggle for the footer. The "what/why" of anonymous analytics
 * lives in the privacy policy (see legalContent.ts); here we keep only the
 * actionable switch so the footer stays uncluttered.
 */
export function AnalyticsOptOutControl() {
  const t = useTr();
  const analytics = useAnalytics();
  const [optedOut, setOptedOut] = useState(readAnalyticsOptOutPreference);

  useEffect(() => {
    setOptedOut(readAnalyticsOptOutPreference() || analytics.isOptedOut());
  }, [analytics]);

  const enabled = !optedOut;

  return (
    <Switch
      size="sm"
      checked={enabled}
      label={t("analytics.optout.toggle")}
      aria-label={t("analytics.optout.toggle")}
      onChange={(event) => {
        const nextEnabled = event.currentTarget.checked;
        writeAnalyticsOptOutPreference(!nextEnabled);
        if (nextEnabled) analytics.optIn();
        else analytics.optOut();
        setOptedOut(!nextEnabled);
      }}
      styles={{
        label: { color: "var(--app-text-muted)", fontSize: "var(--mantine-font-size-xs)" },
      }}
    />
  );
}
