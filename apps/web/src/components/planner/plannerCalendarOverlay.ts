/**
 * Shared geometry for the graph planner's "open in calendar" floating overlay.
 * The left (reused planner panel) and right (calendar card) both dock inside
 * `.canvasWrap` with a margin on every side and a gap between them, so the two
 * cards read as floating above the dimmed graph. Centralised so the panel's
 * docked width and the calendar card's left offset stay in sync.
 */
export const CALENDAR_OVERLAY_MARGIN = 24;
const CALENDAR_OVERLAY_GAP = 16;

/** Docked width of the left (planner) panel, responsive to the canvas width. */
export const CALENDAR_OVERLAY_LEFT_WIDTH = "clamp(300px, 32%, 400px)";

/** Left inset of the right (calendar) card: margin + left panel + gap. */
export const CALENDAR_OVERLAY_CARD_LEFT = `calc(${CALENDAR_OVERLAY_MARGIN}px + ${CALENDAR_OVERLAY_LEFT_WIDTH} + ${CALENDAR_OVERLAY_GAP}px)`;
