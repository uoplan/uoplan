import type { BlockedTimeWindow, CourseEnrollment, GenerationConstraints, TimeSlot } from "./types";

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

/**
 * Ensures that for each day, there is at most one "gap" between consecutive classes,
 * and that gap is no longer than 90 minutes.
 * A gap is defined as the time between the end of one class and the start of the next
 * on the same day, provided the next class doesn't start immediately or overlap.
 */
export function satisfiesCompressedConstraint(enrollments: CourseEnrollment[]): boolean {
  const timesByDay: Record<string, TimeSlot[]> = {};
  for (const e of enrollments) {
    for (const t of e.times) {
      if (!timesByDay[t.day]) {
        timesByDay[t.day] = [];
      }
      timesByDay[t.day].push(t);
    }
  }

  for (const day of Object.keys(timesByDay)) {
    const times = timesByDay[day];
    if (times.length <= 1) continue;

    times.sort((a, b) => a.startMinutes - b.startMinutes);
    let gapCount = 0;
    for (let i = 0; i < times.length - 1; i++) {
      const current = times[i];
      const next = times[i + 1];
      // Due to overlap checking elsewhere, current.endMinutes <= next.startMinutes usually.
      // A gap exists if the next class starts strictly after the current class ends.
      if (next.startMinutes > current.endMinutes) {
        const gapDuration = next.startMinutes - current.endMinutes;
        if (gapDuration > 0) {
          gapCount++;
          if (gapCount > 1 || gapDuration > 90) {
            return false;
          }
        }
      }
    }
  }

  return true;
}
