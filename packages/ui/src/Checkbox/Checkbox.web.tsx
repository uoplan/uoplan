import { Checkbox as MantineCheckbox } from "@mantine/core";

import type { CheckboxProps } from "./Checkbox.types";

/** Web (Mantine) implementation of the Checkbox contract. */
export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled,
  testID,
}: CheckboxProps) {
  return (
    <MantineCheckbox
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      label={label}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
