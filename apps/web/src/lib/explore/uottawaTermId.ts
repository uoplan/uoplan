/**
 * PeopleSoft-style uOttawa term stream ids are typically 4 digits: `2` + `YY` + `S`
 * where YY is the last two digits of the calendar year and S is the session digit:
 * Fall = 9, Winter = 1, Spring/Summer = 5 (e.g. 2269 → Fall Term 2026).
 */
export function formatUottawaTermIdLabel(termId: number): string {
  const n = Math.abs(Math.floor(Number(termId)));
  const s = String(n);

  if (s.length !== 4) {
    return s;
  }

  const eraPrefix = s[0];
  const yy = Number.parseInt(s.slice(1, 3), 10);
  const sessionDigit = Number.parseInt(s[3], 10);

  if (!Number.isFinite(yy) || !Number.isFinite(sessionDigit)) {
    return s;
  }

  // Observed stream ids use leading `2` for current-era undergraduate terms.
  if (eraPrefix !== "2") {
    return s;
  }

  const year = 2000 + yy;
  let session: string | null = null;
  if (sessionDigit === 9) session = "Fall";
  else if (sessionDigit === 1) session = "Winter";
  else if (sessionDigit === 5) session = "Spring/Summer";

  if (!session) {
    return s;
  }

  return `${session} Term ${year}`;
}
