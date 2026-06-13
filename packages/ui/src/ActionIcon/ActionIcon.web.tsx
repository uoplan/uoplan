import { ActionIcon as MantineActionIcon } from "@mantine/core";

import { ACTION_ICON_SIZE } from "./ActionIcon.types";
import type { ActionIconProps } from "./ActionIcon.types";

/** Web (Mantine) implementation of the ActionIcon contract. */
export function ActionIcon({
  children,
  onPress,
  variant = "subtle",
  size = "md",
  disabled,
  label,
  testID,
}: ActionIconProps) {
  return (
    <MantineActionIcon
      variant={variant}
      size={ACTION_ICON_SIZE[size]}
      disabled={disabled}
      onClick={onPress}
      aria-label={label}
      data-testid={testID}
    >
      {children}
    </MantineActionIcon>
  );
}
