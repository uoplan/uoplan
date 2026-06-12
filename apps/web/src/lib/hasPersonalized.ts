import { peekHasPersonalizedFromBase64 } from "@uoplan/core";
import { LOCAL_STORAGE_KEY } from "../store/constants";

/**
 * Whether persisted state shows the user has personalized (program / completed
 * courses / basket). Reads localStorage directly and decodes only proto fields,
 * so it works on the landing page before the catalogue/indices are loaded — the
 * store's resolved `program` is unavailable until app data loads.
 */
export function readPersistedPersonalized(): boolean {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return false;
    return peekHasPersonalizedFromBase64(stored);
  } catch {
    return false;
  }
}
