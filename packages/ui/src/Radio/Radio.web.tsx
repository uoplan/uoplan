import { Radio as MantineRadio, Stack } from "@mantine/core";

import type { RadioProps } from "./Radio.types";

/** Web (Mantine) implementation of the Radio contract. */
export function Radio({ value, onChange, data, label, disabled, testID }: RadioProps) {
  return (
    <MantineRadio.Group
      value={value}
      onChange={(next) => onChange?.(next)}
      label={label}
      data-testid={testID}
    >
      <Stack gap="xs" mt={label ? "xs" : undefined}>
        {data.map((option) => (
          <MantineRadio
            key={option.value}
            value={option.value}
            label={option.label}
            disabled={disabled}
          />
        ))}
      </Stack>
    </MantineRadio.Group>
  );
}
