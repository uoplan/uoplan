import { Animated, Pressable, StyleSheet, View } from "react-native";

import { Spacing, Surface } from "@/constants/theme";

interface StepDotsProps {
  count: number;
  activeIndex: number;
  scrollX?: Animated.Value;
  pageWidth?: number;
  onDotPress?: (index: number) => void;
  testID?: string;
}

/**
 * Compact pager position indicator. When `scrollX` and `pageWidth` are supplied,
 * neighbouring dots gently scale with the swipe progress; otherwise the selected
 * dot is emphasized from the discrete active index.
 */
export function StepDots({
  count,
  activeIndex,
  scrollX,
  pageWidth,
  onDotPress,
  testID = "step-dots",
}: StepDotsProps) {
  if (count <= 1) return null;

  const progress =
    scrollX && pageWidth && pageWidth > 0 ? Animated.divide(scrollX, pageWidth) : null;

  return (
    <View testID={testID} accessibilityRole="tablist" style={styles.row}>
      {Array.from({ length: count }, (_, index) => {
        const selected = index === activeIndex;
        const animatedStyle = progress
          ? {
              width: progress.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [8, 18, 8],
                extrapolate: "clamp",
              }),
              backgroundColor: progress.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [Surface.faint, Surface.accent, Surface.faint],
                extrapolate: "clamp",
              }),
              opacity: progress.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [0.45, 1, 0.45],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [index - 1, index, index + 1],
                    outputRange: [0.86, 1.18, 0.86],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }
          : null;

        return (
          <Pressable
            key={index}
            testID={`step-dot-${index}`}
            accessibilityRole="tab"
            accessibilityLabel={`Go to step ${index + 1}`}
            accessibilityState={{ selected }}
            onPress={() => onDotPress?.(index)}
            disabled={!onDotPress}
            hitSlop={{ top: 13, bottom: 13, left: 4, right: 4 }}
            style={styles.hitArea}
          >
            <Animated.View
              style={[
                styles.dot,
                progress ? animatedStyle : selected ? styles.dotActive : styles.dotIdle,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  hitArea: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotIdle: {
    backgroundColor: Surface.faint,
  },
  dotActive: {
    width: 18,
    backgroundColor: Surface.accent,
  },
});
