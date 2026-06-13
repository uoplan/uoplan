import { Pressable, View } from "react-native";

import { ACTION_ICON_SIZE } from "./ActionIcon.types";
import type { ActionIconProps, ActionIconVariant } from "./ActionIcon.types";

const FILLED_BG = "#2a2826";
const LIGHT_BG = "#f0ede8";
const DEFAULT_BG = "#fffdfa";
const BORDER_COLOR = "#ebe6dd";

function background(variant: ActionIconVariant): string {
  switch (variant) {
    case "filled":
      return FILLED_BG;
    case "light":
      return LIGHT_BG;
    case "default":
      return DEFAULT_BG;
    case "subtle":
      return "transparent";
  }
}

/** Native (React Native) implementation of the ActionIcon contract. */
export function ActionIcon({
  children,
  onPress,
  variant = "subtle",
  size = "md",
  disabled,
  label,
  testID,
}: ActionIconProps) {
  const dimension = ACTION_ICON_SIZE[size];
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (!disabled) onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background(variant),
        borderWidth: variant === "default" ? 1 : 0,
        borderColor: BORDER_COLOR,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
}
