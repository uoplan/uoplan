import { Button as MantineButton } from "@mantine/core";

import type { ButtonProps } from "./Button.types";

/** Web (Mantine) implementation of the Button contract. */
export function Button({
  children,
  onPress,
  variant = "filled",
  disabled,
  fullWidth,
  testID,
}: ButtonProps) {
  return (
    <MantineButton
      variant={variant}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onPress}
      data-testid={testID}
    >
      {children}
    </MantineButton>
  );
}
