import type { CSSProperties, ReactNode } from "react";
import { Box } from "@mantine/core";
import { PAGE_CENTER_REF_PX } from "../../lib/layout/pageWidth";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Centers page content at the shared site measure: the visible column is
 * `PAGE_CONTENT_MAX_PX` (960) wide with a `PAGE_GUTTER_PX` gutter on each side
 * (16px on mobile). It owns its own gutter, so the surrounding `<main>` only
 * needs vertical padding.
 *
 * Full-bleed / edge-to-edge content should sit *outside* a PageContainer (or use
 * {@link PageFullBleed}) and re-center its inner content with its own
 * PageContainer so it lines up with the rest of the page.
 */
export function PageContainer({ children, className, style }: PageContainerProps) {
  return (
    <Box
      className={className}
      px={{ base: 16, sm: 24 }}
      style={{
        width: "100%",
        maxWidth: PAGE_CENTER_REF_PX,
        marginInline: "auto",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Breaks a child out to the full viewport width from within a padded layout, so
 * sticky bars and edge-to-edge sections can span the screen. Re-center the inner
 * content with a {@link PageContainer} so it aligns with the page column.
 */
export function PageFullBleed({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <Box
      style={{
        width: "100vw",
        maxWidth: "100vw",
        marginInline: "calc(50% - 50vw)",
        ...style,
      }}
    >
      {children}
    </Box>
  );
}
