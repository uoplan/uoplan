import { Text as MantineText } from "@mantine/core";

import { TEXT_FONT_WEIGHT } from "./textStyle";
import type { TextProps } from "./Text.types";

/** Web (Mantine) implementation of the Text contract. */
export function Text({
  children,
  size,
  weight,
  color,
  align,
  dimmed,
  numberOfLines,
  testID,
}: TextProps) {
  return (
    <MantineText
      size={size}
      fw={weight ? TEXT_FONT_WEIGHT[weight] : undefined}
      c={color ?? (dimmed ? "dimmed" : undefined)}
      ta={align}
      lineClamp={numberOfLines}
      data-testid={testID}
    >
      {children}
    </MantineText>
  );
}
