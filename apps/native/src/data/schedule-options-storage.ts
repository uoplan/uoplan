import type { File as FileType, Paths as PathsType } from "expo-file-system";

import {
  DEFAULT_SCHEDULE_OPTIONS,
  parseScheduleOptions,
  serializeScheduleOptions,
  type ScheduleOptions,
} from "@/lib/schedule-options";

/** File (under the persistent document dir) the generation options live in. */
const OPTIONS_FILE = "uoplan-schedule-options.json";

// `expo-file-system` is required lazily (not statically imported) so the store
// stays out of the jest render-test module graph — the same pattern used by
// `data/basket-storage.ts` and `lib/push.ts`. apps/native is excluded from
// oxlint, so require() is fine.
function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

/** Load the persisted generation options from disk (defaults on any failure). */
export async function readScheduleOptions(): Promise<ScheduleOptions> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, OPTIONS_FILE);
    if (!file.exists) return { ...DEFAULT_SCHEDULE_OPTIONS };
    return parseScheduleOptions(await file.text());
  } catch {
    return { ...DEFAULT_SCHEDULE_OPTIONS };
  }
}

/** Persist the generation options to disk (best-effort; failures are swallowed). */
export async function writeScheduleOptions(options: ScheduleOptions): Promise<void> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, OPTIONS_FILE);
    file.write(serializeScheduleOptions(options));
  } catch {
    // best-effort: a failed write must not break the UI.
  }
}
