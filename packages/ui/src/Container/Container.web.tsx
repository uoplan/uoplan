import { Container as MantineContainer } from "@mantine/core";

import { resolveSpacing } from "../layout/style";
import type { ContainerProps } from "./Container.types";

/** Web (Mantine) implementation of the Container contract. */
export function Container({ children, maxWidth = 960, px, testID }: ContainerProps) {
  return (
    <MantineContainer size={maxWidth} px={resolveSpacing(px)} data-testid={testID}>
      {children}
    </MantineContainer>
  );
}
