import { Card as MantineCard } from "@mantine/core";

import { resolveRadius, resolveSpacing } from "../layout/style";
import type { CardProps } from "./Card.types";

/** Web (Mantine) implementation of the Card contract. */
export function Card({
  children,
  p = "md",
  radius = "md",
  withBorder = true,
  shadow,
  testID,
}: CardProps) {
  return (
    <MantineCard
      padding={resolveSpacing(p)}
      radius={resolveRadius(radius)}
      withBorder={withBorder}
      shadow={shadow && shadow !== "none" ? shadow : undefined}
      data-testid={testID}
    >
      {children}
    </MantineCard>
  );
}
