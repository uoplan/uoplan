import type { ReactNode } from "react";

import { AnimatePresence as FramerAnimatePresence, motion } from "framer-motion";

import { DEFAULT_MOTION_DURATION, resolveMotionState } from "./Motion.types";
import type { MotionProps } from "./Motion.types";

/** Web (framer-motion) implementation of the Motion contract. */
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
  return (
    <motion.div
      data-testid={testID}
      initial={{ opacity: start.opacity, y: start.translateY, scale: start.scale }}
      animate={{ opacity: end.opacity, y: end.translateY, scale: end.scale }}
      exit={{ opacity: start.opacity, y: start.translateY, scale: start.scale }}
      transition={{ duration: duration / 1000, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Web AnimatePresence — re-exports framer-motion's so exiting children animate
 * their Motion `from` state on unmount. The native variant is a passthrough
 * (RN handles exit via reanimated layout animations per-child).
 */
export function AnimatePresence({ children }: { children?: ReactNode }) {
  return <FramerAnimatePresence>{children}</FramerAnimatePresence>;
}
