import { Divider as MantineDivider } from "@mantine/core";

import { resolveSpacing } from "../layout/style";
import type { DividerProps } from "./Divider.types";

/** Web (Mantine) implementation of the Divider contract. */
export function Divider({ orientation = "horizontal", my, mx, testID }: DividerProps) {
  return (
    <MantineDivider
      orientation={orientation}
      my={resolveSpacing(my)}
      mx={resolveSpacing(mx)}
      data-testid={testID}
    />
  );
}
