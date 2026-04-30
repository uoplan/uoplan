import { useState } from 'react';
import { Group, Switch, Text, Tooltip } from '@mantine/core';
import { IconBell, IconBellOff } from '@tabler/icons-react';

const WORKER_URL =
  (import.meta.env.VITE_NOTIFICATIONS_URL as string | undefined) ??
  'https://notifications.uoplan.party';
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';
const LS_KEY = 'uoplan-notifications';

type NotifState =
  | { status: 'disabled' }
  | { status: 'subscribed'; subscription: PushSubscriptionJSON }
  | { status: 'denied' };

function loadState(): NotifState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { status: 'disabled' };
    return JSON.parse(raw) as NotifState;
  } catch {
    return { status: 'disabled' };
  }
}

function saveState(state: NotifState): void {
  if (state.status === 'disabled') {
    localStorage.removeItem(LS_KEY);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

function getUnsupportedReason(): string | null {
  if ('PushManager' in window) return null;
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return 'Add uoplan to your Home Screen to enable notifications';
  }
  return 'Push notifications are not supported in this browser';
}

export function NotificationToggle() {
  const [state, setState] = useState<NotifState>(loadState);
  const [loading, setLoading] = useState(false);

  const unsupportedReason = getUnsupportedReason();
  const isSubscribed = state.status === 'subscribed';
  const isDenied = state.status === 'denied';

  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY is not set');
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        const next: NotifState = { status: 'denied' };
        saveState(next);
        setState(next);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });

      await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      const next: NotifState = { status: 'subscribed', subscription: sub.toJSON() };
      saveState(next);
      setState(next);
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (state.status !== 'subscribed') return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();

      await fetch(`${WORKER_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      });

      saveState({ status: 'disabled' });
      setState({ status: 'disabled' });
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  const icon = isSubscribed ? <IconBell size={14} /> : <IconBellOff size={14} />;
  const tooltipLabel = unsupportedReason ?? (isDenied ? 'Notifications blocked in browser settings' : undefined);

  return (
    <Group justify="space-between" align="center">
      <Group gap="xs">
        {icon}
        <Text size="sm" c="dimmed">
          Notify me when new terms are added
        </Text>
      </Group>
      <Tooltip
        label={tooltipLabel}
        disabled={!tooltipLabel}
        withArrow
        multiline
        w={200}
      >
        <span>
          <Switch
            checked={isSubscribed}
            disabled={!!unsupportedReason || isDenied || loading}
            onChange={isSubscribed ? handleDisable : handleEnable}
            size="sm"
          />
        </span>
      </Tooltip>
    </Group>
  );
}
