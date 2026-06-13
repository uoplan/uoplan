import { Pressable, StyleSheet, Text } from "react-native";

import type { ButtonProps } from "./Button.types";

/** Native (React Native) implementation of the Button contract. */
export function Button({
  children,
  onPress,
  variant = "filled",
  disabled,
  fullWidth,
  testID,
}: ButtonProps) {
  const isSubtle = variant === "subtle" || variant === "default";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        isSubtle && styles.subtle,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, isSubtle && styles.subtleLabel]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#1f1f1f",
  },
  subtle: {
    backgroundColor: "transparent",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  subtleLabel: {
    color: "#1f1f1f",
  },
});
