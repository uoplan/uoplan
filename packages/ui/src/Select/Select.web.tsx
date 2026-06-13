import { Select as MantineSelect } from "@mantine/core";

import type { SelectProps } from "./Select.types";

/** Web (Mantine) implementation of the Select contract. */
export function Select({
  value,
  onChange,
  data,
  label,
  placeholder,
  disabled,
  testID,
}: SelectProps) {
  return (
    <MantineSelect
      value={value ?? null}
      onChange={onChange}
      data={data}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
