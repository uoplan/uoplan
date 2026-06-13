import { Indicator as MantineIndicator } from "@mantine/core";

import { BADGE_TONES } from "../Badge/tones";
import type { IndicatorProps } from "./Indicator.types";

/** Web (Mantine) implementation of the Indicator contract. */
export function Indicator({
  children,
  label,
  tone = "danger",
  position = "top-end",
  disabled,
  testID,
}: IndicatorProps) {
  return (
    <MantineIndicator
      label={label}
      color={BADGE_TONES[tone].fg}
      position={position}
      disabled={disabled}
      size={label == null ? 10 : 16}
      data-testid={testID}
    >
      {children}
    </MantineIndicator>
  );
}
