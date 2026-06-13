import { File, Paths } from "expo-file-system";
import { Share } from "react-native";

import { buildScheduleIcs, type BuildIcsArgs } from "./ics";

export interface ExportScheduleIcsArgs extends BuildIcsArgs {
  /** File name written into the cache dir. Defaults to `uoplan-schedule.ics`. */
  fileName?: string;
}

/**
 * Build the schedule `.ics`, persist it to a cache file, and present the native
 * share sheet so the user can add it to Apple/Google Calendar or save it. Uses
 * React Native's built-in `Share` with a `file://` URL (no extra dependency).
 * Returns the share result so callers can react to dismiss/share.
 */
export async function exportScheduleIcs({ fileName, ...buildArgs }: ExportScheduleIcsArgs) {
  const ics = buildScheduleIcs(buildArgs);
  const file = new File(Paths.cache, fileName ?? "uoplan-schedule.ics");
  if (file.exists) file.delete();
  file.write(ics);
  return Share.share({ url: file.uri, title: "uoplan schedule" });
}
