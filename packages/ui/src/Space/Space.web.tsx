import { Space as MantineSpace } from "@mantine/core";

import { resolveSpacing } from "../layout/style";
import type { SpaceProps } from "./Space.types";

/** Web (Mantine) implementation of the Space contract. */
export function Space({ h, w, testID }: SpaceProps) {
  return <MantineSpace h={resolveSpacing(h)} w={resolveSpacing(w)} data-testid={testID} />;
}
