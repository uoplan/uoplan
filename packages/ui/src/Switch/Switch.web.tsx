import { Switch as MantineSwitch } from "@mantine/core";

import type { SwitchProps } from "./Switch.types";

/** Web (Mantine) implementation of the Switch contract. */
export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled,
  testID,
}: SwitchProps) {
  return (
    <MantineSwitch
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      label={label}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
