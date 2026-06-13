import { Alert as MantineAlert } from "@mantine/core";

import type { AlertProps } from "./Alert.types";
import { ALERT_MANTINE_COLOR } from "./tones";

/** Web (Mantine) implementation of the Alert contract. */
export function Alert({ children, title, tone = "info", testID }: AlertProps) {
  return (
    <MantineAlert
      title={title}
      color={ALERT_MANTINE_COLOR[tone]}
      variant="light"
      data-testid={testID}
    >
      {children}
    </MantineAlert>
  );
}
