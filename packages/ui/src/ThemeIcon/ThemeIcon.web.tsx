import { Box } from "@mantine/core";

import { BADGE_TONES } from "../Badge/tones";
import { resolveRadius } from "../layout/style";
import { THEME_ICON_SIZE } from "./ThemeIcon.types";
import type { ThemeIconProps } from "./ThemeIcon.types";

/** Web (Mantine) implementation of the ThemeIcon contract. */
export function ThemeIcon({
  children,
  tone = "accent",
  size = "md",
  radius = "md",
  testID,
}: ThemeIconProps) {
  const colors = BADGE_TONES[tone];
  const dimension = THEME_ICON_SIZE[size];
  return (
    <Box
      data-testid={testID}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: resolveRadius(radius),
        backgroundColor: colors.bg,
        color: colors.fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Box>
  );
}
