/** Space reserved beside content so accordion chevron does not shift histogram alignment. */
const EXPLORE_CHEVRON_GUTTER_PX = 40;

/** Padding inline for accordion - responsive: smaller on mobile. */
export const EXPLORE_ACCORDION_PAD_INLINE = {
  base: "16px",
  xs: "max(24px, calc((100vw - min(100vw, 1200px)) / 2 + 24px))",
};

/** Padding right for accordion - responsive with chevron gutter. */
export const EXPLORE_ACCORDION_PAD_RIGHT = {
  base: `calc(16px + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
  xs: `calc(max(24px, calc((100vw - min(100vw, 1200px)) / 2 + 24px)) + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
};
