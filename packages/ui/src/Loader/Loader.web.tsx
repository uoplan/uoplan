import { Loader as MantineLoader } from "@mantine/core";

import type { LoaderProps } from "./Loader.types";

/** Web (Mantine) implementation of the Loader contract. */
export function Loader({ size = "md", testID }: LoaderProps) {
  return <MantineLoader size={size} data-testid={testID} />;
}
