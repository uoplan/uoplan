import { Skeleton as MantineSkeleton } from "@mantine/core";

import type { SkeletonProps } from "./Skeleton.types";

/** Web (Mantine) implementation of the Skeleton contract. */
export function Skeleton({ width, height, radius, testID }: SkeletonProps) {
  return <MantineSkeleton width={width} height={height} radius={radius} data-testid={testID} />;
}
