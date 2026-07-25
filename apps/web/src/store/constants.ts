import { DEFAULT_SCHOOL_ID } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

export const LOCAL_STORAGE_KEY = "uoplan-state";

/**
 * localStorage key holding the encoded planner state for `school`.
 *
 * uOttawa deliberately keeps the original unsuffixed key so every existing
 * user's saved plan survives the move to multi-school; only additional schools
 * get a suffix.
 */
export function stateStorageKey(school: SchoolId): string {
  return school === DEFAULT_SCHOOL_ID ? LOCAL_STORAGE_KEY : `${LOCAL_STORAGE_KEY}:${school}`;
}
