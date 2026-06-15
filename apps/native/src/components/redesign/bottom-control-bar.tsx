import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GlassSurface } from "@/components/glass-surface";
import { Surface } from "@/constants/theme";

interface BottomControlBarProps {
  /** Leading schedule-options button (generation preferences, not app settings). */
  onSettings?: () => void;
  /** Pager. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Centre label, e.g. "3 / 12". */
  label?: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  bottom?: number;
}

/**
 * Floating bottom control bar for the schedule screen: a schedule-options button
 * on the left (opens generation preferences) and a prev/next pager pill in the
 * centre, used to page through generated schedules. Mirrors the web mobile
 * schedule control bar.
 */
export function BottomControlBar({
  onSettings,
  onPrev,
  onNext,
  label,
  prevDisabled,
  nextDisabled,
  bottom = 24,
}: BottomControlBarProps) {
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {onSettings ? (
        <GlassSurface interactive style={styles.gear}>
          <Pressable onPress={onSettings} accessibilityRole="button" style={styles.gearPressable}>
            <AppIcon name="slider.horizontal.3" size={20} color={Surface.label} />
          </Pressable>
        </GlassSurface>
      ) : (
        <View style={styles.gearSpacer} />
      )}

      <GlassSurface style={styles.pager}>
        <Pressable
          onPress={onPrev}
          disabled={prevDisabled}
          accessibilityRole="button"
          style={styles.pagerBtn}
        >
          <AppIcon
            name="chevron.left"
            size={18}
            color={prevDisabled ? Surface.faint : Surface.label}
          />
        </Pressable>
        {label ? (
          <Text size="sm" weight="bold">
            {label}
          </Text>
        ) : null}
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          accessibilityRole="button"
          style={styles.pagerBtn}
        >
          <AppIcon
            name="chevron.right"
            size={18}
            color={nextDisabled ? Surface.faint : Surface.label}
          />
        </Pressable>
      </GlassSurface>

      <View style={styles.gearSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gear: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gearPressable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gearSpacer: {
    width: 48,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    overflow: "hidden",
  },
  pagerBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
