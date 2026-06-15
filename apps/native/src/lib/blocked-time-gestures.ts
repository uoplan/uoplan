import {
  CAL_END_MINUTES,
  CAL_START_MINUTES,
  clampToCalendarRange,
  snapMinutes,
} from "@uoplan/calendar/layout";
import type { BlockedTimeWindow, DayOfWeek } from "@uoplan/core";

export const BLOCKED_TIME_MIN_MINUTES = 30;
export const BLOCKED_TIME_MOVE_THRESHOLD_PX = 6;
export const BLOCKED_TIME_LONG_PRESS_MS = 350;
export const BLOCKED_TIME_SNAP_MINUTES = 5;

export interface CalendarGestureLayout {
  startMinutes: number;
  endMinutes: number;
  heightPx: number;
}

export type ResizeEdge = "top" | "bottom";

export function yToCalendarMinutes(y: number, layout: CalendarGestureLayout): number {
  const height = Math.max(1, layout.heightPx);
  const clampedY = Math.max(0, Math.min(height, y));
  const span = layout.endMinutes - layout.startMinutes;
  const minutes = layout.startMinutes + (clampedY / height) * span;
  return clampGestureMinutes(snapMinutes(minutes, BLOCKED_TIME_SNAP_MINUTES), layout);
}

export function minutesToCalendarY(minutes: number, layout: CalendarGestureLayout): number {
  const span = Math.max(1, layout.endMinutes - layout.startMinutes);
  const clamped = Math.max(layout.startMinutes, Math.min(layout.endMinutes, minutes));
  return ((clamped - layout.startMinutes) / span) * Math.max(1, layout.heightPx);
}

export function buildCreateBlockedTimeDraft(
  day: DayOfWeek,
  anchorMinutes: number,
  currentY: number,
  layout: CalendarGestureLayout,
): BlockedTimeWindow {
  const currentMinutes = yToCalendarMinutes(currentY, layout);
  return {
    day,
    startMinutes: Math.min(anchorMinutes, currentMinutes),
    endMinutes: Math.max(anchorMinutes, currentMinutes),
  };
}

export function shouldCommitBlockedTimeDraft(draft: BlockedTimeWindow): boolean {
  return draft.endMinutes - draft.startMinutes >= BLOCKED_TIME_MIN_MINUTES;
}

export function moveBlockedTimeDraft(
  block: BlockedTimeWindow,
  anchorMinutes: number,
  currentY: number,
  layout: CalendarGestureLayout,
): BlockedTimeWindow {
  const currentMinutes = yToCalendarMinutes(currentY, layout);
  const duration = block.endMinutes - block.startMinutes;
  const delta = currentMinutes - anchorMinutes;
  const start = Math.max(
    layout.startMinutes,
    Math.min(block.startMinutes + delta, layout.endMinutes - duration),
  );
  return { day: block.day, startMinutes: start, endMinutes: start + duration };
}

export function resizeBlockedTimeDraft(
  block: BlockedTimeWindow,
  edge: ResizeEdge,
  currentY: number,
  layout: CalendarGestureLayout,
): BlockedTimeWindow {
  const currentMinutes = yToCalendarMinutes(currentY, layout);
  if (edge === "top") {
    return {
      day: block.day,
      startMinutes: Math.max(
        layout.startMinutes,
        Math.min(currentMinutes, block.endMinutes - BLOCKED_TIME_MIN_MINUTES),
      ),
      endMinutes: block.endMinutes,
    };
  }
  return {
    day: block.day,
    startMinutes: block.startMinutes,
    endMinutes: Math.min(
      layout.endMinutes,
      Math.max(currentMinutes, block.startMinutes + BLOCKED_TIME_MIN_MINUTES),
    ),
  };
}

export function blockTopHeight(
  block: BlockedTimeWindow,
  layout: CalendarGestureLayout,
): { top: number; height: number } {
  const top = minutesToCalendarY(block.startMinutes, layout);
  const bottom = minutesToCalendarY(block.endMinutes, layout);
  return { top, height: Math.max(1, bottom - top) };
}

function clampGestureMinutes(minutes: number, layout: CalendarGestureLayout): number {
  return Math.max(
    Math.max(CAL_START_MINUTES, layout.startMinutes),
    Math.min(Math.min(CAL_END_MINUTES, layout.endMinutes), minutes),
  );
}
