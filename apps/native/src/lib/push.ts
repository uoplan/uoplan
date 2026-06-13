import type * as NotificationsModule from "expo-notifications";

/**
 * Native push/notification helpers (C7). The simulator and a bare Expo build
 * can't obtain a remote APNs push token (that needs an EAS `projectId` + a
 * physical device), so this module focuses on the parts that DO work everywhere:
 * permission handling and *local* schedule reminders. The same `enableReminders`
 * entry point is what a future remote-push registration would hang off of, and
 * mirrors the web app's NotificationToggle behaviour (opt-in, permission-gated).
 *
 * `expo-notifications` is loaded lazily (not a static import) on purpose: the
 * module deep-imports `react-native/...` internals that the jest harness does
 * not dedupe to the app's single React copy, so importing it eagerly would pull
 * a duplicate React instance into any component that renders this toggle. Lazy
 * loading keeps it out of the module graph until a function is actually called.
 */

function notifications(): typeof NotificationsModule {
  // apps/native is excluded from oxlint, so require() is fine here.
  return require("expo-notifications");
}

export type PushPermission = "granted" | "denied" | "undetermined";

function normalize(status: string): PushPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

/** Current notification permission, without prompting. */
export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await notifications().getPermissionsAsync();
  return normalize(status);
}

/** Prompt for notification permission, returning the resulting state. */
export async function requestPushPermission(): Promise<PushPermission> {
  const { status } = await notifications().requestPermissionsAsync();
  return normalize(status);
}

/**
 * Schedule a local reminder a few seconds out (the on-device proof that
 * notifications are wired). Returns the scheduled notification id.
 */
export async function scheduleScheduleReminder(secondsFromNow = 5): Promise<string> {
  const Notifications = notifications();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "uoplan",
      body: "Your timetable is ready to review.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      repeats: false,
    },
  });
}

export interface EnableRemindersResult {
  permission: PushPermission;
  /** Scheduled notification id, when permission was granted. */
  notificationId?: string;
}

/**
 * Opt the user into schedule reminders: ensure permission (prompting if needed),
 * then schedule the reminder. A no-op (returns the denied state) if the user
 * declines, so the caller can reflect the real permission state in the UI.
 */
export async function enableReminders(): Promise<EnableRemindersResult> {
  let permission = await getPushPermission();
  if (permission !== "granted") {
    permission = await requestPushPermission();
  }
  if (permission !== "granted") {
    return { permission };
  }
  const notificationId = await scheduleScheduleReminder();
  return { permission, notificationId };
}
