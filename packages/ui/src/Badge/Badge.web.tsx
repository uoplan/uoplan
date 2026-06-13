import { Badge as MantineBadge } from "@mantine/core";

import type { BadgeProps } from "./Badge.types";
import { BADGE_TONES } from "./tones";

/** Web (Mantine) implementation of the Badge contract. */
export function Badge({ children, tone = "neutral", testID }: BadgeProps) {
  const colors = BADGE_TONES[tone];
  return (
    <MantineBadge
      variant="light"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
      data-testid={testID}
    >
      {children}
    </MantineBadge>
  );
}
