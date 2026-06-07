import { SchedulePreview } from "@uoplan/proto/state";
import { buildSchedulePreview, type GeneratedSchedule, type SchedulesData } from "@uoplan/core";

/**
 * Encodes the currently-generated schedule into the index-based
 * {@link SchedulePreview} embedded in share URLs (`?p=`), so the OG-image worker
 * can render it without re-running schedule generation. Indices reference the
 * term's schedules dataset, which the worker also loads. Returns a base64url
 * string, or `null` when the schedule encodes to no resolvable courses.
 */
export function encodeSchedulePreview(
  schedule: GeneratedSchedule,
  schedulesData: SchedulesData,
  termId: string,
): string | null {
  const preview = buildSchedulePreview(schedule, schedulesData, Number(termId));
  if (preview.courses.length === 0) return null;

  const bytes = SchedulePreview.encode(preview).finish();
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
