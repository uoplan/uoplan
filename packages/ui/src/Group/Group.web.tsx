import { Group as MantineGroup } from "@mantine/core";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { GroupProps } from "./Group.types";

/** Web (Mantine) implementation of the Group contract. */
export function Group({ children, gap, align, justify, wrap, flex, testID }: GroupProps) {
  return (
    <MantineGroup
      gap={resolveSpacing(gap)}
      align={resolveAlign(align)}
      justify={resolveJustify(justify)}
      wrap={wrap ? "wrap" : "nowrap"}
      style={{ flex }}
      data-testid={testID}
    >
      {children}
    </MantineGroup>
  );
}
