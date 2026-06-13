import { SimpleGrid as MantineSimpleGrid } from "@mantine/core";

import { resolveSpacing } from "../layout/style";
import type { SimpleGridProps } from "./SimpleGrid.types";

/** Web (Mantine) implementation of the SimpleGrid contract. */
export function SimpleGrid({ children, cols, spacing, testID }: SimpleGridProps) {
  return (
    <MantineSimpleGrid cols={cols} spacing={resolveSpacing(spacing)} data-testid={testID}>
      {children}
    </MantineSimpleGrid>
  );
}
