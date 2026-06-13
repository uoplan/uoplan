import { Title as MantineTitle } from "@mantine/core";

import type { TitleProps } from "./Title.types";

/** Web (Mantine) implementation of the Title contract. */
export function Title({ children, order = 1, testID }: TitleProps) {
  return (
    <MantineTitle order={order} data-testid={testID}>
      {children}
    </MantineTitle>
  );
}
