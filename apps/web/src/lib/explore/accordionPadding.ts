/** Space reserved beside content so accordion chevron does not shift histogram alignment. */
const EXPLORE_CHEVRON_GUTTER_PX = 40;

/** Minimum gutter between the explore content column and the viewport edge. */
const EXPLORE_GUTTER_PX = 24;

/**
 * Width of the explore content column. Matches the landing page's content width
 * (maw 960) so explore reads at the same measure as the rest of the site.
 */
const EXPLORE_CONTENT_MAX_PX = 960;

/**
 * Centering reference width: the content width plus a gutter on each side. The
 * padding formulas below center content to this width, so the visible column is
 * `EXPLORE_CONTENT_MAX_PX` with at least `EXPLORE_GUTTER_PX` of edge spacing.
 */
export const EXPLORE_CENTER_REF_PX = EXPLORE_CONTENT_MAX_PX + EXPLORE_GUTTER_PX * 2;

/** Padding inline for accordion - responsive: smaller on mobile. */
export const EXPLORE_ACCORDION_PAD_INLINE = {
  base: "16px",
  xs: `max(${EXPLORE_GUTTER_PX}px, calc((100vw - min(100vw, ${EXPLORE_CENTER_REF_PX}px)) / 2 + ${EXPLORE_GUTTER_PX}px))`,
};

/** Padding right for accordion - responsive with chevron gutter. */
export const EXPLORE_ACCORDION_PAD_RIGHT = {
  base: `calc(16px + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
  xs: `calc(max(${EXPLORE_GUTTER_PX}px, calc((100vw - min(100vw, ${EXPLORE_CENTER_REF_PX}px)) / 2 + ${EXPLORE_GUTTER_PX}px)) + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
};
