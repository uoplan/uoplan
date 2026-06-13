import { Paper as MantinePaper } from "@mantine/core";

import { resolveRadius, resolveSpacing } from "../layout/style";
import type { PaperProps } from "./Paper.types";

/** Web (Mantine) implementation of the Paper contract. */
export function Paper({ children, p, radius, withBorder, shadow, testID }: PaperProps) {
  return (
    <MantinePaper
      p={resolveSpacing(p)}
      radius={resolveRadius(radius)}
      withBorder={withBorder}
      shadow={shadow && shadow !== "none" ? shadow : undefined}
      data-testid={testID}
    >
      {children}
    </MantinePaper>
  );
}
