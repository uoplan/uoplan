import { useCallback, useEffect, useState } from "react";

import { useAppData } from "@/data/data-provider";

export interface CourseDescriptionState {
  description: string | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Lazily fetch the description for a single course from the appropriate
 * description shard via the native DataClient (from `useAppData()`).
 *
 * - Fires only when `courseCode` is non-null.
 * - Clears stale `description`/`error` immediately when inputs change.
 * - Ignores async completions that arrive after the inputs have changed.
 * - `retry()` re-triggers the fetch (the dataClient evicts the decoded shard
 *   on error, so failures are always retryable).
 * - Propagates errors as `Error` objects; never silently swallows them.
 *
 * @param courseCode Exact course code to look up (e.g. "MAT 1320"). Null → idle.
 * @param facultyId  Faculty slug used as the description shard id, or null to
 *                   fall back to the `"other"` shard (DataClient maps null → "other").
 */
export function useCourseDescription(
  courseCode: string | null,
  facultyId: string | null,
): CourseDescriptionState {
  const { dataClient } = useAppData();
  const [retryToken, setRetryToken] = useState(0);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const retry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!courseCode) {
      setDescription(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;

    // Clear stale data synchronously so stale content is never shown between
    // input changes and the new response.
    setDescription(null);
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const result = await dataClient.loadCourseDescription(facultyId, courseCode);
        if (active) {
          setDescription(result ?? null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // retryToken is the only way to manually re-trigger; courseCode/facultyId
    // changes are handled by the effect's own dependency tracking.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [courseCode, facultyId, retryToken, dataClient]);

  return { description, loading, error, retry };
}
