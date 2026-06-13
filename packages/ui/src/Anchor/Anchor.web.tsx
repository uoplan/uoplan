import { Anchor as MantineAnchor } from "@mantine/core";

import type { AnchorProps } from "./Anchor.types";

/** Web (Mantine) implementation of the Anchor contract. */
export function Anchor({ children, href, onPress, testID }: AnchorProps) {
  return (
    <MantineAnchor href={href} onClick={onPress} data-testid={testID}>
      {children}
    </MantineAnchor>
  );
}
