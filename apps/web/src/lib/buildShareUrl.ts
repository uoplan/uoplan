import type { GeneratedSchedule, SchedulesData } from "@uoplan/core";
import { encodeSchedulePreview } from "./encodeSchedulePreview";

interface BuildShareUrlInput {
  origin: string;
  encodedStateBase64: string;
  currentSchedule: GeneratedSchedule | null;
  schedulesData: SchedulesData | null;
  selectedTermId: string | null;
}

function toBase64Url(base64: string): string {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function buildShareUrl({
  origin,
  encodedStateBase64,
  currentSchedule,
  schedulesData,
  selectedTermId,
}: BuildShareUrlInput): string {
  const base64url = toBase64Url(encodedStateBase64);
  let url = `${origin}/api/share/${base64url}`;

  if (currentSchedule && schedulesData && selectedTermId) {
    const preview = encodeSchedulePreview(currentSchedule, schedulesData, selectedTermId);
    if (preview) url += `?p=${preview}`;
  }

  return url;
}
