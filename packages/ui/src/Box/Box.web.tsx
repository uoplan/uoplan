import { Box as MantineBox } from "@mantine/core";

import { resolveSpacing } from "../layout/style";
import type { BoxProps } from "./Box.types";

/** Web (Mantine) implementation of the Box contract. */
export function Box({ children, p, px, py, m, mx, my, flex, testID }: BoxProps) {
  return (
    <MantineBox
      data-testid={testID}
      style={{
        padding: resolveSpacing(p),
        paddingLeft: resolveSpacing(px),
        paddingRight: resolveSpacing(px),
        paddingTop: resolveSpacing(py),
        paddingBottom: resolveSpacing(py),
        margin: resolveSpacing(m),
        marginLeft: resolveSpacing(mx),
        marginRight: resolveSpacing(mx),
        marginTop: resolveSpacing(my),
        marginBottom: resolveSpacing(my),
        flex,
      }}
    >
      {children}
    </MantineBox>
  );
}
