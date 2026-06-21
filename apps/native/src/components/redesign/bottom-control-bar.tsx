import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GlassSurface } from "@/components/glass-surface";
import { Spacing, Surface } from "@/constants/theme";

interface BottomControlBarProps {
  /** Leading schedule-options button (generation preferences, not app settings). */
  onSettings?: () => void;
  /** Variant pager. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Centre label, e.g. "Schedule 3". */
  label?: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Show a spinner in place of the next chevron while the next item generates. */
  nextLoading?: boolean;
  /**
   * Week pager, shown as a smaller pill above the variant pager. Only rendered
   * when {@link weekLabel} is set (i.e. the active schedule spans more than one
   * distinct week pattern), so single-pattern terms stay uncluttered.
   */
  weekLabel?: string;
  onWeekPrev?: () => void;
  onWeekNext?: () => void;
  weekPrevDisabled?: boolean;
  weekNextDisabled?: boolean;
  bottom?: number;
}

/**
 * Floating bottom control bar for the schedule screen: a schedule-options button
 * on the left (opens generation preferences) and a prev/next pager pill in the
 * centre, used to page through generated schedules. Mirrors the web mobile
 * schedule control bar. The next chevron can show a spinner ({@link
 * BottomControlBarProps.nextLoading}) while the next schedule is generated
 * lazily. When the active schedule spans multiple distinct week patterns, a
 * smaller week pager ({@link BottomControlBarProps.weekLabel}) sits above it.
 */
export function BottomControlBar({
  onSettings,
  onPrev,
  onNext,
  label,
  prevDisabled,
  nextDisabled,
  nextLoading,
  weekLabel,
  onWeekPrev,
  onWeekNext,
  weekPrevDisabled,
  weekNextDisabled,
  bottom = 24,
}: BottomControlBarProps) {
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {weekLabel ? (
        <GlassSurface style={styles.weekPager}>
          <Pressable
            onPress={onWeekPrev}
            disabled={weekPrevDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            style={styles.weekBtn}
          >
            <AppIcon
              name="chevron.left"
              size={18}
              color={weekPrevDisabled ? Surface.faint : Surface.label}
            />
          </Pressable>
          <Text size="sm" weight="semibold">
            {weekLabel}
          </Text>
          <Pressable
            onPress={onWeekNext}
            disabled={weekNextDisabled}
            accessibilityRole="button"
            accessibilityLabel="Next week"
            style={styles.weekBtn}
          >
            <AppIcon
              name="chevron.right"
              size={18}
              color={weekNextDisabled ? Surface.faint : Surface.label}
            />
          </Pressable>
        </GlassSurface>
      ) : null}

      <View style={styles.mainRow} pointerEvents="box-none">
        {onSettings ? (
          <View style={styles.gearAnchor} pointerEvents="box-none">
            <GlassSurface interactive style={styles.gear}>
              <Pressable
                onPress={onSettings}
                accessibilityRole="button"
                accessibilityLabel="Schedule options"
                style={styles.gearPressable}
                hitSlop={8}
              >
                <AppIcon name="slider.horizontal.3" size={24} color={Surface.label} />
              </Pressable>
            </GlassSurface>
          </View>
        ) : null}

        <GlassSurface style={styles.pager}>
          <Pressable
            onPress={onPrev}
            disabled={prevDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous schedule"
            style={styles.pagerBtn}
          >
            <AppIcon
              name="chevron.left"
              size={22}
              color={prevDisabled ? Surface.faint : Surface.label}
            />
          </Pressable>
          {label ? (
            <Text size="md" weight="bold">
              {label}
            </Text>
          ) : null}
          <Pressable
            onPress={onNext}
            disabled={nextDisabled || nextLoading}
            accessibilityRole="button"
            accessibilityLabel="Next schedule"
            style={styles.pagerBtn}
          >
            {nextLoading ? (
              <ActivityIndicator size="small" color={Surface.label} />
            ) : (
              <AppIcon
                name="chevron.right"
                size={22}
                color={nextDisabled ? Surface.faint : Surface.label}
              />
            )}
          </Pressable>
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: Spacing.two,
  },
  mainRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  weekPager: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    height: 40,
    paddingHorizontal: Spacing.two,
    borderRadius: 20,
    overflow: "hidden",
  },
  weekBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  gearAnchor: {
    position: "absolute",
    left: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  gear: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    height: 56,
    paddingHorizontal: Spacing.two,
    borderRadius: 28,
    overflow: "hidden",
  },
  pagerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
