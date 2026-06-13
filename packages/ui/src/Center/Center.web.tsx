import { Center as MantineCenter } from "@mantine/core";

import type { CenterProps } from "./Center.types";

/** Web (Mantine) implementation of the Center contract. */
export function Center({ children, flex, testID }: CenterProps) {
  return (
    <MantineCenter style={{ flex }} data-testid={testID}>
      {children}
    </MantineCenter>
  );
}
