import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated } from "react-native";

import { DEFAULT_MOTION_DURATION, resolveMotionState } from "./Motion.types";
import type { MotionProps } from "./Motion.types";

/**
 * Native implementation of the Motion contract. Uses React Native's built-in
 * `Animated` (driven on the native thread) rather than reanimated worklets, so
 * it needs no extra Babel plugin and animates reliably under the jest harness.
 * A single 0→1 progress value interpolates opacity / translateY / scale between
 * `from` and `to` on mount.
 */
export function Motion({
  children,
  from,
  to,
  duration = DEFAULT_MOTION_DURATION,
  delay = 0,
  testID,
}: MotionProps) {
  const start = resolveMotionState(from);
  const end = resolveMotionState(to);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, duration, delay]);

  const interpolate = (a: number, b: number) =>
    a === b ? a : progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

  return (
    <Animated.View
      testID={testID}
      style={{
        opacity: interpolate(start.opacity, end.opacity),
        transform: [
          { translateY: interpolate(start.translateY, end.translateY) },
          { scale: interpolate(start.scale, end.scale) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Native AnimatePresence — a passthrough. React Native lacks framer-motion's
 * exit-animation machinery; screens that need exit transitions use per-child
 * layout animations instead. Kept so shared screens can wrap children in the
 * same component on both platforms.
 */
export function AnimatePresence({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
