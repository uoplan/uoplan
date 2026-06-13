import { Notification as MantineNotification } from "@mantine/core";

import { ALERT_MANTINE_COLOR } from "../Alert/tones";
import type { NotificationProps } from "./Notification.types";

/** Web (Mantine) implementation of the Notification contract. */
export function Notification({
  title,
  children,
  tone = "info",
  onClose,
  testID,
}: NotificationProps) {
  return (
    <MantineNotification
      title={title}
      color={ALERT_MANTINE_COLOR[tone]}
      onClose={onClose}
      withCloseButton={onClose != null}
      data-testid={testID}
    >
      {children}
    </MantineNotification>
  );
}
