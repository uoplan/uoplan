import { NumberInput as MantineNumberInput } from "@mantine/core";

import type { NumberInputProps } from "./NumberInput.types";

/** Web (Mantine) implementation of the NumberInput contract. */
export function NumberInput({
  value,
  defaultValue,
  onChange,
  min,
  max,
  step,
  label,
  placeholder,
  disabled,
  testID,
}: NumberInputProps) {
  return (
    <MantineNumberInput
      value={value}
      defaultValue={defaultValue}
      onChange={(next) => {
        if (typeof next === "number") onChange?.(next);
        else onChange?.();
      }}
      min={min}
      max={max}
      step={step}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
