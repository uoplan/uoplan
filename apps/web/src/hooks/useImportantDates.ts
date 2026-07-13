import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ImportantDatesData, ImportantDatesLocale } from "@uoplan/core";
import { loadImportantDates } from "@uoplan/data";
import { i18n, normalizeLocale } from "../i18n";
import { fetchProtoBytes } from "../lib/protoFetch";

export interface UseImportantDatesResult {
  data: ImportantDatesData | null;
  loading: boolean;
  error: Error | null;
  retry(): void;
}

function getActiveLocale(): ImportantDatesLocale {
  return normalizeLocale(i18n.locale);
}

// Stable module-scope subscribe so useSyncExternalStore never sees a new
// reference across renders (avoids unsubscribe+resubscribe churn).
function subscribeToLocaleChanges(onStoreChange: () => void): () => void {
  return i18n.on("change", onStoreChange);
}

/**
 * Locale-aware hook that fetches and decodes the important-dates asset for the
 * active app locale. Re-loads automatically when the locale changes, clearing
 * stale data immediately. Stale/out-of-order responses are discarded via a
 * per-effect `active` flag. Failed loads are retryable via `retry()`.
 */
export function useImportantDates(): UseImportantDatesResult {
  // Subscribe to locale changes without requiring an I18nProvider in the tree.
  // Module-scope subscribe ensures a stable reference across renders.
  const locale = useSyncExternalStore(
    subscribeToLocaleChanges,
    getActiveLocale,
    () => "en" as const,
  );

  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<{
    data: ImportantDatesData | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: true, error: null });

  // Stable retry callback: incrementing retryCount re-triggers the load effect.
  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let active = true;
    // Clear any previous locale's data immediately so consumers never see
    // stale content while the new locale is loading.
    setState({ data: null, loading: true, error: null });

    void (async () => {
      try {
        const data = await loadImportantDates(fetchProtoBytes, locale);
        if (!active) return;
        // Guard against the (unlikely) case where the decoded asset carries a
        // different locale than requested — surface an actionable error rather
        // than silently displaying wrong-language content.
        if (data.locale !== locale) {
          setState({
            data: null,
            loading: false,
            error: new Error(
              `Important dates asset locale "${data.locale}" does not match requested locale "${locale}"`,
            ),
          });
          return;
        }
        setState({ data, loading: false, error: null });
      } catch (err: unknown) {
        if (!active) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    })();

    return () => {
      // Prevents state updates from a superseded locale's in-flight request.
      active = false;
    };
  }, [locale, retryCount]);

  return { ...state, retry };
}
