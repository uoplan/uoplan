import { useEffect, useState } from "react";

import { Stack, Switch, Text } from "@uoplan/ui";

import {
  enableReminders as enableRemindersImpl,
  type EnableRemindersResult,
  getPushPermission as getPushPermissionImpl,
  type PushPermission,
} from "@/lib/push";

const STATUS_LABEL: Record<PushPermission, string> = {
  granted: "Reminders on — we'll nudge you when a schedule is ready.",
  denied: "Notifications are blocked in Settings.",
  undetermined: "Get a reminder when your timetable is ready.",
};

export interface NotificationToggleProps {
  /** Permission probe (injectable for tests); defaults to the real push module. */
  getPermission?: () => Promise<PushPermission>;
  /** Opt-in handler (injectable for tests); defaults to the real push module. */
  enable?: () => Promise<EnableRemindersResult>;
}

/**
 * Native analogue of the web NotificationToggle: an opt-in switch that requests
 * notification permission and schedules a local schedule reminder. Reflects the
 * real OS permission state (so a denied switch can't be flipped back on).
 *
 * The push handlers are injected (defaulting to the real `@/lib/push`
 * implementation) so render tests can drive it without mocking native modules.
 */
export function NotificationToggle({
  getPermission = getPushPermissionImpl,
  enable = enableRemindersImpl,
}: NotificationToggleProps = {}) {
  const [permission, setPermission] = useState<PushPermission>("undetermined");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getPermission()
      .then((status) => {
        if (active) setPermission(status);
      })
      .catch(() => {
        // Notifications unavailable (e.g. unsupported context) — stay opt-in.
      });
    return () => {
      active = false;
    };
  }, [getPermission]);

  const enabled = permission === "granted";

  const handleChange = async (next: boolean) => {
    if (!next || busy) return;
    setBusy(true);
    try {
      const result = await enable();
      setPermission(result.permission);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="xs">
      <Switch
        label="Schedule reminders"
        checked={enabled}
        disabled={busy || permission === "denied"}
        onChange={(next) => void handleChange(next)}
        testID="schedule-reminders-switch"
      />
      <Text size="xs" dimmed>
        {STATUS_LABEL[permission]}
      </Text>
    </Stack>
  );
}
