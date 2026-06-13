import { Flex as MantineFlex } from "@mantine/core";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { FlexProps } from "./Flex.types";

/** Web (Mantine) implementation of the Flex contract. */
export function Flex({
  children,
  direction = "row",
  gap,
  align,
  justify,
  wrap,
  flex,
  testID,
}: FlexProps) {
  return (
    <MantineFlex
      direction={direction}
      gap={resolveSpacing(gap)}
      align={resolveAlign(align)}
      justify={resolveJustify(justify)}
      wrap={wrap ? "wrap" : "nowrap"}
      flex={flex}
      data-testid={testID}
    >
      {children}
    </MantineFlex>
  );
}
