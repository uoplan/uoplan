import { Collapse as MantineCollapse } from "@mantine/core";

import type { CollapseProps } from "./Collapse.types";

/** Web (Mantine) implementation of the Collapse contract. */
export function Collapse({ open, children, testID }: CollapseProps) {
  return (
    <MantineCollapse expanded={open} data-testid={testID}>
      {children}
    </MantineCollapse>
  );
}
