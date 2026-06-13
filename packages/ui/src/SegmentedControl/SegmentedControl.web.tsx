import { SegmentedControl as MantineSegmentedControl } from "@mantine/core";

import type { SegmentedControlProps } from "./SegmentedControl.types";

/** Web (Mantine) implementation of the SegmentedControl contract. */
export function SegmentedControl({
  value,
  onChange,
  data,
  fullWidth,
  disabled,
  testID,
}: SegmentedControlProps) {
  return (
    <MantineSegmentedControl
      value={value}
      onChange={(next) => onChange?.(next)}
      data={data}
      fullWidth={fullWidth}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
