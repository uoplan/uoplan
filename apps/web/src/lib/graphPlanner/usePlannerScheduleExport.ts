import { useCallback, useState } from "react";
import type { DataCache } from "@uoplan/core";
import { tr } from "../../i18n";
import { useImportantDates } from "../../hooks/useImportantDates";
import { useAnalytics } from "../analytics";
import { downloadTextFile } from "../downloadFile";
import { buildScheduleExport } from "../scheduleExport";
import type { ScheduleExportRequest } from "../scheduleExport";
import { buildAllTermsExportRequest, buildTermExportRequest } from "./downloadPlannerIcs";
import type { PlannerTermDownload } from "./downloadPlannerIcs";

export interface UsePlannerScheduleExportResult {
  /** The snapshotted request backing the currently-open dialog, or `null` while closed. */
  readonly request: ScheduleExportRequest | null;
  /** Localized term label for a single-term export's dialog scope; unset for "all". */
  readonly scopeLabel: string | undefined;
  /**
   * Snapshot a single term's export request and open the dialog. No-op
   * (mirrors `canDownloadTerm`) when the term has no dated schedule.
   */
  openTermExport: (term: PlannerTermDownload) => void;
  /**
   * Snapshot the combined export request across every downloadable term and
   * open the dialog. No-op when nothing is downloadable.
   */
  openAllTermsExport: (terms: PlannerTermDownload[]) => void;
  /** Close the dialog and discard the snapshot. */
  close: () => void;
  /**
   * `ScheduleExportDialog`'s `onExport`: resolves important-dates enrichment,
   * downloads, and fires analytics — or throws a localized, actionable error,
   * leaving the dialog open.
   */
  onExport: (options: { includeDeadlines: boolean }) => Promise<void>;
}

/**
 * Owns the graph planner's schedule-export dialog lifecycle.
 *
 * Snapshots the deterministic export request (`buildTermExportRequest` /
 * `buildAllTermsExportRequest`) the instant a download action fires, so later
 * planner edits made while the dialog stays open can never silently change
 * what's about to be exported — the snapshot lives in plain `useState` and is
 * only ever replaced by another explicit `openTermExport` /
 * `openAllTermsExport` call, never recomputed reactively.
 *
 * `useImportantDates()` is called exactly once here (the dialog owner), so
 * both the single-term and "all terms" flows share one in-flight load/retry
 * rather than each starting their own.
 */
export function usePlannerScheduleExport(cache: DataCache | null): UsePlannerScheduleExportResult {
  const [request, setRequest] = useState<ScheduleExportRequest | null>(null);
  const [scopeLabel, setScopeLabel] = useState<string | undefined>();
  const importantDates = useImportantDates();
  const analytics = useAnalytics();

  const openTermExport = useCallback(
    (term: PlannerTermDownload) => {
      const next = buildTermExportRequest(term, cache);
      if (!next) return;
      setScopeLabel(term.label);
      setRequest(next);
    },
    [cache],
  );

  const openAllTermsExport = useCallback(
    (terms: PlannerTermDownload[]) => {
      const next = buildAllTermsExportRequest(terms, cache);
      if (!next) return;
      setScopeLabel(undefined);
      setRequest(next);
    },
    [cache],
  );

  const close = useCallback(() => {
    setRequest(null);
    setScopeLabel(undefined);
  }, []);

  const onExport = useCallback(
    async ({ includeDeadlines }: { includeDeadlines: boolean }) => {
      if (!request) {
        // Unreachable in practice: the dialog only renders while `request` is set.
        throw new Error(tr("scheduleExport.error"));
      }

      if (importantDates.loading || importantDates.error || !importantDates.data) {
        // A prior load failure gets exactly one retry per export attempt —
        // triggered here, from the user's click, never from an effect — so a
        // later attempt can succeed once the retry resolves.
        if (importantDates.error) importantDates.retry();
        throw new Error(tr("scheduleExport.error"));
      }

      try {
        const result = buildScheduleExport(request, {
          data: importantDates.data,
          includeDeadlines,
        });
        downloadTextFile(result.filename, result.ics, "text/calendar;charset=utf-8");
      } catch {
        // Normalize technical failures (missing-term resolution, download
        // boundary errors, …) to the dialog's generic, localized, actionable
        // message rather than leaking internals to the student.
        throw new Error(tr("scheduleExport.error"));
      }

      // `schedule_exported`'s analytics contract (packages/analytics/src/events.ts)
      // only declares `target`; `includeDeadlines`/`scope` aren't part of that
      // shared, typed event schema, so they're intentionally omitted here
      // rather than smuggled in as untyped extra properties.
      analytics.capture("schedule_exported", { target: "ics" });
    },
    [request, importantDates, analytics],
  );

  return { request, scopeLabel, openTermExport, openAllTermsExport, close, onExport };
}
