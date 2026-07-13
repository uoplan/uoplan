import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import type { ImportantDateTerm } from "@uoplan/core/dataTypes";
import { buildImportantDatesIcs } from "@uoplan/core";
import { tr } from "../i18n";
import { downloadTextFile } from "../lib/downloadFile";
import { useImportantDates } from "../hooks/useImportantDates";
import { ImportantDatesPage } from "../components/importantDates/ImportantDatesPage";
import { buildPageHead } from "../lib/seo";

export const Route = createFileRoute("/important-dates-and-deadlines")({
  head: () => buildPageHead("importantDates"),
  component: ImportantDatesRoute,
});

function ImportantDatesRoute() {
  const hook = useImportantDates();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Stable ref so the download guard survives re-renders without deps
  const downloadingRef = useRef(false);

  const handleDownload = useCallback(async (term: ImportantDateTerm) => {
    if (downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    setDownloadError(null);
    try {
      const ics = buildImportantDatesIcs(term);
      const filename = `uoplan-important-dates-${term.season}-${term.year}.ics`;
      downloadTextFile(filename, ics, "text/calendar;charset=utf-8");
    } catch {
      setDownloadError(tr("importantDates.downloadError"));
    } finally {
      setDownloading(false);
      downloadingRef.current = false;
    }
  }, []);

  // Inline: setDownloadError is stable, hook.retry() is a direct method call
  const handleRetry = () => {
    setDownloadError(null);
    hook.retry();
  };

  return (
    <ImportantDatesPage
      data={hook.data}
      loading={hook.loading}
      error={hook.error}
      onRetry={handleRetry}
      onDownload={handleDownload}
      downloading={downloading}
      downloadError={downloadError}
    />
  );
}
