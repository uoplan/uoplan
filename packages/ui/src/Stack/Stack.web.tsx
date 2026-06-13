import { Stack as MantineStack } from "@mantine/core";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { StackProps } from "./Stack.types";

/** Web (Mantine) implementation of the Stack contract. */
export function Stack({ children, gap, align, justify, flex, testID }: StackProps) {
  return (
    <MantineStack
      gap={resolveSpacing(gap)}
      align={resolveAlign(align)}
      justify={resolveJustify(justify)}
      style={{ flex }}
      data-testid={testID}
    >
      {children}
    </MantineStack>
  );
}
