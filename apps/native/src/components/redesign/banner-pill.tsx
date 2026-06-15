import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

type BannerVariant = "accent" | "warning";

const VARIANTS: Record<BannerVariant, { bg: string; border: string; fg: string }> = {
  accent: { bg: Surface.accentSoft, border: Surface.accentSoft, fg: Surface.accent },
  warning: { bg: Surface.warningSoft, border: Surface.warningSoft, fg: Surface.warning },
};

interface BannerPillProps {
  label: string;
  variant?: BannerVariant;
  /** Optional leading SF Symbol (e.g. "sparkles" for a personalize nudge). */
  icon?: IconName;
  onPress?: () => void;
  onClose?: () => void;
}

/** A rounded accent/warning banner pill with an optional leading icon and an
 *  optional X — mirrors the web mobile personalize top banner. */
export function BannerPill({ label, variant = "accent", icon, onPress, onClose }: BannerPillProps) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.pill, { backgroundColor: v.bg, borderColor: v.border }]}
    >
      <View style={styles.labelRow}>
        {icon ? <AppIcon name={icon} size={15} color={v.fg} /> : null}
        <Text size="sm" color={v.fg}>
          {label}
        </Text>
      </View>
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
          <AppIcon name="xmark" size={14} color={v.fg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    flexShrink: 1,
  },
});
