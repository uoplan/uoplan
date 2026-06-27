import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@uoplan/ui";

import { Spacing, Surface } from "@/constants/theme";

const LOGO = require("@/assets/images/party-logo.png");

/**
 * Wealthsimple-style data-loading gate: a blank paper-coloured screen with the
 * uoplan logo gently pulsating (scale + opacity loop) while all `.pb` data loads
 * and the explore index builds. No wordmark, no spinner — just the mark.
 *
 * When `exiting` flips true (data ready), the whole overlay cross-fades out while
 * the logo drifts upward, then calls `onExitComplete` so the gate can unmount it
 * — revealing the app underneath instead of hard-cutting into view.
 */
export function LoadingScreen({
  exiting = false,
  onExitComplete,
}: {
  exiting?: boolean;
  onExitComplete?: () => void;
}) {
  const progress = useSharedValue(0);
  const intro = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    // Quick fade/scale-in so the mark materialises rather than popping in at
    // full opacity, then settles into the gentle pulse loop below.
    intro.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [progress, intro]);

  useEffect(() => {
    if (!exiting) return;
    exit.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onExitComplete) runOnJS(onExitComplete)();
    });
  }, [exiting, exit, onExitComplete]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: (0.92 + progress.value * 0.08) * (0.96 + intro.value * 0.04) },
      { translateY: exit.value * -48 },
    ],
    opacity: (0.65 + progress.value * 0.35) * intro.value,
  }));

  return (
    <Animated.View style={[styles.root, styles.overlay, rootStyle]} pointerEvents="none">
      <Animated.View style={logoStyle}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
      </Animated.View>
    </Animated.View>
  );
}

/** Full-screen error state with a retry affordance, shown if data load fails. */
export function LoadingErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Image source={LOGO} style={styles.logoStatic} contentFit="contain" />
      <View style={styles.errorBody}>
        <Text align="center" weight="bold" size="lg">
          Couldn’t load data
        </Text>
        <Text align="center" dimmed>
          Check your connection and try again.
        </Text>
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          <Text color={Surface.onAccent} weight="bold">
            Retry
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.page,
    gap: Spacing.five,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logo: {
    width: 96,
    height: 96,
  },
  logoStatic: {
    width: 72,
    height: 72,
    opacity: 0.9,
  },
  errorBody: {
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  retry: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    backgroundColor: Surface.accent,
  },
});
