import { Group, Stack, Switch, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTr } from "../../i18n";
import {
  readAnalyticsOptOutPreference,
  useAnalytics,
  writeAnalyticsOptOutPreference,
} from "../../lib/analytics";

export function AnalyticsOptOutControl() {
  const t = useTr();
  const analytics = useAnalytics();
  const [optedOut, setOptedOut] = useState(readAnalyticsOptOutPreference);

  useEffect(() => {
    setOptedOut(readAnalyticsOptOutPreference() || analytics.isOptedOut());
  }, [analytics]);

  const enabled = !optedOut;

  return (
    <Group gap="sm" align="center" wrap="nowrap">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" c="dimmed" fw={600} lh={1.35}>
          {t("analytics.optout.title")}
        </Text>
        <Text size="xs" c="dimmed" lh={1.45} maw={360}>
          {t("analytics.optout.description")}
        </Text>
      </Stack>
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
    </Group>
  );
}
