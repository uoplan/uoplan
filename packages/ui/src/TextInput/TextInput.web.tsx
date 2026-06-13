import { TextInput as MantineTextInput } from "@mantine/core";

import type { TextInputProps } from "./TextInput.types";

/** Web (Mantine) implementation of the TextInput contract. */
export function TextInput({
  value,
  defaultValue,
  onChangeText,
  placeholder,
  label,
  disabled,
  testID,
}: TextInputProps) {
  return (
    <MantineTextInput
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onChangeText?.(event.currentTarget.value)}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
      data-testid={testID}
    />
  );
}
