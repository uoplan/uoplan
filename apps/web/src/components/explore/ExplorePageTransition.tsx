import { Stack } from "@mantine/core";
import { m } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Entrance-motion shell shared by the Explore entity pages (course / discipline /
 * faculty): a fade-up `m.div` wrapping a gapless `Stack`. Keeps the page-enter
 * transition identical across the three pages.
 */
export function ExplorePageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>{children}</Stack>
    </m.div>
  );
}
