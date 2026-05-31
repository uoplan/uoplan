import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "@mantine/hooks";

interface AnimatedIconSwapProps {
  /** Unique key for the current icon state. When it changes, the icon crossfades. */
  statusKey: string;
  /** The icon to render for the current state. */
  children: ReactNode;
  /** Width/height of the square icon box in pixels. */
  size?: number;
}

/**
 * Crossfades and slightly scales between icon states so toggling an icon
 * (e.g. a save indicator switching glyphs) feels smooth rather than abrupt.
 *
 * The icons are absolutely positioned and overlap during the transition so the
 * surrounding layout never shifts. Honours `prefers-reduced-motion` by swapping
 * instantly.
 */
export function AnimatedIconSwap({ statusKey, children, size = 16 }: AnimatedIconSwapProps) {
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={statusKey}
          initial={prefersReduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
