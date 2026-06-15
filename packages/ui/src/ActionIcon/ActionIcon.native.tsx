import { Pressable, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import { ACTION_ICON_SIZE } from "./ActionIcon.types";
import type { ActionIconProps, ActionIconVariant } from "./ActionIcon.types";

const FILLED_BG = NativeColors.text;
const LIGHT_BG = NativeColors.surfaceHover;
const DEFAULT_BG = NativeColors.surface;
const BORDER_COLOR = NativeColors.border;

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
