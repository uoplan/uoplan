export function formatUtcDateRange(start: string, end: string, invalidFallback?: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (invalidFallback !== undefined && (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))) {
    return invalidFallback;
  }
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const fmtNoYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtWithYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const startStr = sameYear ? fmtNoYear.format(s) : fmtWithYear.format(s);
  return `${startStr} – ${fmtWithYear.format(e)}`;
}
