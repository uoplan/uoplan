import { ScrollArea as MantineScrollArea } from "@mantine/core";

import type { ScrollAreaProps } from "./ScrollArea.types";

/** Web (Mantine) implementation of the ScrollArea contract. */
export function ScrollArea({ children, direction = "vertical", fill, testID }: ScrollAreaProps) {
  return (
    <MantineScrollArea
      scrollbars={direction === "horizontal" ? "x" : "y"}
      style={fill ? { flex: 1 } : undefined}
      data-testid={testID}
    >
      {children}
    </MantineScrollArea>
  );
}
