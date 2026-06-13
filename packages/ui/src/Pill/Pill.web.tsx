import { Pill as MantinePill } from "@mantine/core";

import type { PillProps } from "./Pill.types";

/** Web (Mantine) implementation of the Pill contract. */
export function Pill({ children, testID }: PillProps) {
  return <MantinePill data-testid={testID}>{children}</MantinePill>;
}
