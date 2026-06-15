import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Fonts, Spacing, Surface } from "@/constants/theme";

export type PillButtonVariant = "primary" | "secondary" | "destructive";

interface PillButtonProps {
  label: string;
  onPress: () => void;
  /** Visual treatment. Defaults to the high-contrast inverted `primary`. */
  variant?: PillButtonVariant;
  /** Optional leading SF Symbol. */
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Forwarded to the underlying Pressable for test/automation hooks. */
  testID?: string;
  /** Layout/position style merged onto the pill. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Per-variant fill / foreground / border colours.
 *
 * - `primary` is a high-contrast **inverted** CTA: the label colour fills the
 *   button (white in dark mode, black in light mode) with the page colour as the
 *   text — the Wealthsimple-style solid pill used for "Generate schedule" /
 *   "Add to calendar".
 * - `secondary` is a neutral subtle fill with a hairline border.
 * - `destructive` is a translucent-red fill with red text/icon.
 */
const VARIANTS: Record<PillButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: Surface.label, fg: Surface.page, border: Surface.label },
  secondary: { bg: Surface.subtle, fg: Surface.label, border: Surface.border },
  destructive: { bg: Surface.dangerSoft, fg: Surface.danger, border: "transparent" },
};

/**
 * Fully-rounded (pill) action button shared across the basket sheet and the
 * schedule options drawer. Keeps the destructive and primary CTAs visually
 * consistent in one place rather than re-styling inline in each sheet.
 */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: PillButtonProps) {
  const { bg, fg, border } = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <AppIcon name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: "700",
  },
});
