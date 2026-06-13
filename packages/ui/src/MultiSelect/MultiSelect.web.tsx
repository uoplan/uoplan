import { MultiSelect as MantineMultiSelect } from "@mantine/core";

import type { MultiSelectProps } from "./MultiSelect.types";

/** Web (Mantine) implementation of the MultiSelect contract. */
export function MultiSelect({
  value,
  onChange,
  data,
  label,
  placeholder,
  disabled,
  testID,
}: MultiSelectProps) {
  return (
    <MantineMultiSelect
      value={value}
      onChange={onChange}
      data={data}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
