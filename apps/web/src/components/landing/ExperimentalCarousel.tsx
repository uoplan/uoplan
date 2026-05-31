import { Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../../i18n";
import { LandingTile, type LandingTileProps } from "./LandingTile";

const ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

type ExperimentalCarouselProps = {
  items: LandingTileProps[];
};

/**
 * Rotating landing tile for experimental features. Auto-advances (paused on
 * hover/focus/pointer interaction and disabled under reduced-motion), exposes
 * clickable dots, and supports touch swipe. Slides are stacked in a single CSS
 * grid cell so the container keeps a stable height; inactive slides are made
 * `inert` so their links stay out of the tab order and can't be clicked.
 */
export function ExperimentalCarousel({ items }: ExperimentalCarouselProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (prefersReducedMotion || paused || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion, paused, count]);

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStartX.current = event.clientX;
    setPaused(true);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = pointerStartX.current;
    pointerStartX.current = null;
    setPaused(false);
    if (start == null || count <= 1) return;
    const delta = event.clientX - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      goTo(index + (delta < 0 ? 1 : -1));
    }
  };

  if (count === 0) return null;
  if (count === 1) {
    const only = items[0];
    return <LandingTile {...only} />;
  }

  return (
    <Box
      style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointerStartX.current = null;
        setPaused(false);
      }}
    >
      <Box style={{ position: "relative", flex: 1, display: "grid" }}>
        {items.map((item, i) => {
          const isActive = i === index;
          return (
            <motion.div
              key={item.to}
              aria-hidden={!isActive}
              inert={!isActive}
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: "easeOut" }}
              style={{
                gridArea: "1 / 1",
                zIndex: isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              <LandingTile {...item} />
            </motion.div>
          );
        })}
      </Box>

      <Box
        role="tablist"
        aria-label={tr("landing.carousel.label")}
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 12,
        }}
      >
        {items.map((item, i) => {
          const isActive = i === index;
          return (
            <button
              key={item.to}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tr("landing.carousel.goTo", { title: item.title })}
              onClick={() => goTo(i)}
              style={{
                width: isActive ? 22 : 8,
                height: 8,
                padding: 0,
                border: "none",
                borderRadius: "var(--app-radius-pill)",
                cursor: "pointer",
                backgroundColor: isActive ? "var(--app-text)" : "var(--app-border)",
                opacity: isActive ? 0.85 : 0.6,
                transition:
                  "width var(--app-transition), background-color var(--app-transition), opacity var(--app-transition)",
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
