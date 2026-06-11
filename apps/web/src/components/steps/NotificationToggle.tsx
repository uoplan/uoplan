import { useRef, useState } from "react";
import { Box, Group, Loader, Switch, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconBell, IconBellOff } from "@tabler/icons-react";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useTr } from "../../i18n";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
const PUSH_SETUP_MISSING_TITLE_ID = "notifications.pushSetupMissing.title";
const PUSH_SETUP_MISSING_MESSAGE_ID = "notifications.pushSetupMissing.message";
const PUSH_SUBSCRIBE_FAILED_TITLE_ID = "notifications.pushSubscribeFailed.title";
const PUSH_SUBSCRIBE_FAILED_MESSAGE_ID = "notifications.pushSubscribeFailed.message";
const PUSH_UNSUBSCRIBE_FAILED_TITLE_ID = "notifications.pushUnsubscribeFailed.title";
const PUSH_UNSUBSCRIBE_FAILED_MESSAGE_ID = "notifications.pushUnsubscribeFailed.message";
const WARNING_UNSUPPORTED_ID = "notifications.warning.unsupported";
const WARNING_IOS_HOME_SCREEN_ID = "notifications.warning.iosHomeScreen";
const WARNING_BLOCKED_ID = "notifications.warning.blocked";
const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "0x4AAAAAADGEYLH_6_yl1r5j";
const LS_KEY = "uoplan-notifications";

type NotifState =
  | { status: "disabled" }
  | { status: "subscribed"; subscription: PushSubscriptionJSON }
  | { status: "denied" };

function loadState(): NotifState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { status: "disabled" };
    return JSON.parse(raw) as NotifState;
  } catch {
    return { status: "disabled" };
  }
}

function saveState(state: NotifState): void {
  if (state.status === "disabled") {
    localStorage.removeItem(LS_KEY);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function getUnsupportedReasonId(): string | null {
  if ("PushManager" in window) return null;
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return WARNING_IOS_HOME_SCREEN_ID;
  }
  return WARNING_UNSUPPORTED_ID;
}

export function NotificationToggle() {
  const tr = useTr();
  const [state, setState] = useState<NotifState>(loadState);
  const [loading, setLoading] = useState(false);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const resolveTokenRef = useRef<((token: string) => void) | null>(null);
  const rejectTokenRef = useRef<(() => void) | null>(null);

  function getTurnstileToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      resolveTokenRef.current = resolve;
      rejectTokenRef.current = reject;
      turnstileRef.current?.execute();
    });
  }

  function handleTurnstileSuccess(token: string) {
    resolveTokenRef.current?.(token);
    resolveTokenRef.current = null;
    rejectTokenRef.current = null;
  }

  function handleTurnstileFailure() {
    rejectTokenRef.current?.();
    resolveTokenRef.current = null;
    rejectTokenRef.current = null;
  }

  const unsupportedReasonId = getUnsupportedReasonId();
  const isSubscribed = state.status === "subscribed";
  const isDenied = state.status === "denied";

  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) {
      // oxlint-disable-next-line no-console -- intentional push setup configuration error logging
      console.error("VITE_VAPID_PUBLIC_KEY is not set");
      notifications.show({
        color: "red",
        title: tr(PUSH_SETUP_MISSING_TITLE_ID),
        message: tr(PUSH_SETUP_MISSING_MESSAGE_ID),
      });
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const next: NotifState = { status: "denied" };
        saveState(next);
        setState(next);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });

      const token = await getTurnstileToken();
      turnstileRef.current?.reset();

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), "cf-turnstile-response": token }),
      });
      if (!res.ok) {
        throw new Error(`Subscribe request failed with HTTP ${res.status}`);
      }

      const next: NotifState = { status: "subscribed", subscription: sub.toJSON() };
      saveState(next);
      setState(next);
    } catch (err) {
      // oxlint-disable-next-line no-console -- intentional push subscription error logging
      console.error("Failed to subscribe to push notifications:", err);
      notifications.show({
        color: "red",
        title: tr(PUSH_SUBSCRIBE_FAILED_TITLE_ID),
        message: tr(PUSH_SUBSCRIBE_FAILED_MESSAGE_ID),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (state.status !== "subscribed") return;
    setLoading(true);
    try {
      const token = await getTurnstileToken();
      turnstileRef.current?.reset();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();

      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: state.subscription.endpoint,
          "cf-turnstile-response": token,
        }),
      });
      if (!res.ok) {
        throw new Error(`Unsubscribe request failed with HTTP ${res.status}`);
      }

      saveState({ status: "disabled" });
      setState({ status: "disabled" });
    } catch (err) {
      // oxlint-disable-next-line no-console -- intentional push unsubscribe error logging
      console.error("Failed to unsubscribe from push notifications:", err);
      notifications.show({
        color: "red",
        title: tr(PUSH_UNSUBSCRIBE_FAILED_TITLE_ID),
        message: tr(PUSH_UNSUBSCRIBE_FAILED_MESSAGE_ID),
      });
    } finally {
      setLoading(false);
    }
  }

  const icon = isSubscribed ? <IconBell size={14} /> : <IconBellOff size={14} />;
  const warningMessage = unsupportedReasonId
    ? tr(unsupportedReasonId)
    : isDenied
      ? tr(WARNING_BLOCKED_ID)
      : null;

  return (
    <Box
      px="sm"
      py={8}
      style={{
        backgroundColor: "var(--app-surface)",
        border: "var(--app-border-width) solid var(--app-border)",
        borderRadius: "var(--app-radius)",
        boxShadow: "var(--app-shadow-sm)",
      }}
    >
      <Turnstile
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
        options={{ size: "invisible", execution: "execute", appearance: "interaction-only" }}
        onSuccess={handleTurnstileSuccess}
        onError={handleTurnstileFailure}
        onExpire={handleTurnstileFailure}
        style={{ display: "none" }}
      />
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {icon}
          <Text size="sm" c="dimmed" truncate>
            Notify me when new terms are added
          </Text>
        </Group>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {warningMessage && (
            <Tooltip label={warningMessage} withArrow multiline maw={240} position="top">
              <Box
                component="span"
                style={{ display: "inline-flex", alignItems: "center", cursor: "help" }}
              >
                <IconAlertTriangle size={16} color="var(--app-warning)" />
              </Box>
            </Tooltip>
          )}
          <Box
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <Switch
              aria-label="Notify me when new terms are added"
              checked={isSubscribed}
              disabled={!!unsupportedReasonId || isDenied || loading}
              onChange={isSubscribed ? handleDisable : handleEnable}
              size="sm"
              style={
                {
                  "--switch-cursor": "pointer",
                  opacity: loading ? 0 : 1,
                  transition: "opacity 200ms ease",
                  pointerEvents: loading ? "none" : "auto",
                } as React.CSSProperties
              }
            />
            <Loader
              size="xs"
              color="blue"
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                opacity: loading ? 1 : 0,
                transition: "opacity 200ms ease",
                pointerEvents: "none",
              }}
            />
          </Box>
        </Group>
      </Group>
    </Box>
  );
}
