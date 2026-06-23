import type { BlockedTimeWindow, GenerationConstraints, TimeSlot } from "./types";

/** True when the slot overlaps any blocked window on the same weekday (half-open overlap). */
export function timeSlotOverlapsBlocked(
  slot: TimeSlot,
  blockedTimes: readonly BlockedTimeWindow[],
): boolean {
  for (const b of blockedTimes) {
    if (b.day !== slot.day) continue;
    if (slot.startMinutes < b.endMinutes && slot.endMinutes > b.startMinutes) {
      return true;
    }
  }
  return false;
}

/** Time bounds are inclusive: a class starting at minStartMinutes or ending at maxEndMinutes is allowed. */
export function timeSlotSatisfiesConstraints(slot: TimeSlot, c: GenerationConstraints): boolean {
  return (
    slot.startMinutes >= c.minStartMinutes &&
    slot.endMinutes <= c.maxEndMinutes &&
    !(c.blockedTimes && c.blockedTimes.length > 0 && timeSlotOverlapsBlocked(slot, c.blockedTimes))
  );
}
