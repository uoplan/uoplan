import { Tooltip as MantineTooltip } from "@mantine/core";

import type { TooltipProps } from "./Tooltip.types";

/** Web (Mantine) implementation of the Tooltip contract. */
export function Tooltip({ label, children, testID }: TooltipProps) {
  return (
    <MantineTooltip label={label} data-testid={testID}>
      {children}
    </MantineTooltip>
  );
}
