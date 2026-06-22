import type { File as FileType, Paths as PathsType } from "expo-file-system";

import { ANALYTICS_OPT_OUT_STORAGE_KEY } from "@uoplan/analytics";

interface StoredAnalyticsOptOut {
  optedOut: boolean;
}

export const ANALYTICS_OPT_OUT_FILE = `${ANALYTICS_OPT_OUT_STORAGE_KEY.replace(
  /[^a-z0-9._-]+/gi,
  "-",
)}.json`;

export function parseAnalyticsOptOut(text: string): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return false;
  }
  if (typeof raw === "boolean") return raw;
  if (!raw || typeof raw !== "object") return false;
  return (raw as { optedOut?: unknown }).optedOut === true;
}

export function serializeAnalyticsOptOut(optedOut: boolean): string {
  const payload: StoredAnalyticsOptOut = { optedOut };
  return JSON.stringify(payload);
}

function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

export async function readAnalyticsOptOut(): Promise<boolean> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, ANALYTICS_OPT_OUT_FILE);
    if (!file.exists) return false;
    return parseAnalyticsOptOut(await file.text());
  } catch {
    return false;
  }
}

export async function writeAnalyticsOptOut(optedOut: boolean): Promise<void> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, ANALYTICS_OPT_OUT_FILE);
    file.write(serializeAnalyticsOptOut(optedOut));
  } catch {
    // best-effort: a failed preference write must not break app navigation.
  }
}
