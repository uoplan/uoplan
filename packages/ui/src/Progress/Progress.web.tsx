import { Progress as MantineProgress } from "@mantine/core";

import type { ProgressProps } from "./Progress.types";

/** Web (Mantine) implementation of the Progress contract. */
export function Progress({ value, testID }: ProgressProps) {
  return <MantineProgress value={value} data-testid={testID} />;
}
