import { CAL_END_MINUTES, CAL_START_MINUTES, minutesToPercent } from "./weekCalendarLayout";

interface GenerationWindowLayerProps {
  minStartMinutes: number;
  maxEndMinutes: number;
}

/**
 * Read-only shaded regions mirroring the schedule-generation time window ("class times between
 * X and Y") on every calendar day, so the window reads like the blocked times / avoided days.
 * Purely decorative — the real constraint lives in generation state, not the calendar.
 */
export function GenerationWindowLayer({
  minStartMinutes,
  maxEndMinutes,
}: GenerationWindowLayerProps) {
  const start = Math.max(CAL_START_MINUTES, Math.min(minStartMinutes, CAL_END_MINUTES));
  const end = Math.max(CAL_START_MINUTES, Math.min(maxEndMinutes, CAL_END_MINUTES));

  return (
    <>
      {start > CAL_START_MINUTES && (
        <div
          className="cal-outside-hours"
          style={{ top: 0, height: `${minutesToPercent(start)}%` }}
          aria-hidden
        />
      )}
      {end < CAL_END_MINUTES && (
        <div
          className="cal-outside-hours"
          style={{ top: `${minutesToPercent(end)}%`, bottom: 0 }}
          aria-hidden
        />
      )}
    </>
  );
}
