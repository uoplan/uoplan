import type { ReactNode } from "react";

import type { AlertTone } from "../Alert/tones";

/**
 * Shared prop contract for the Notification primitive — a dismissible toast/card
 * with a tone accent. Web maps onto Mantine's `Notification`; native onto a
 * bordered card with a coloured left edge. Tones reuse the shared
 * {@link AlertTone} palette. A close affordance is shown only when `onClose` is
 * provided.
 */
export interface NotificationProps {
  title?: ReactNode;
  /** The notification body. */
  children?: ReactNode;
  tone?: AlertTone;
  /** When provided, a close control is rendered and invokes this on press. */
  onClose?: () => void;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
