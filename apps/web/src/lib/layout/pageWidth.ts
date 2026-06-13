/**
 * Shared content-width tokens for the site's page layout. These are the single
 * source of truth for how wide the main content column reads and how much edge
 * spacing it keeps from the viewport. Home, trends, the explore content column,
 * and the top banners all derive their measure from these values so the site
 * reads at one consistent width.
 */

/** Max width of the centered page content column. */
const PAGE_CONTENT_MAX_PX = 960;

/** Minimum gutter between the content column and the viewport edge. */
export const PAGE_GUTTER_PX = 24;

/**
 * Centering reference width: the content width plus a gutter on each side.
 * Padding/centering formulas can target this so the visible column stays
 * `PAGE_CONTENT_MAX_PX` with at least `PAGE_GUTTER_PX` of edge spacing.
 */
export const PAGE_CENTER_REF_PX = PAGE_CONTENT_MAX_PX + PAGE_GUTTER_PX * 2;
