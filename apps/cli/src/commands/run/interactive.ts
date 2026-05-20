import chalk from "chalk";
import { multiselect, select, text, isCancel, cancel } from "@clack/prompts";
import type { CourseSelection } from "@uoplan/schedule/src/proto/cli";

// ── Time parsing ─────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const WEEKDAYS = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+/i;

function torontoLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  // Create a UTC timestamp treating the local time as UTC, format it in
  // America/Toronto to find the actual offset, then apply the correction.
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(guessUtc);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value);
  const torontoMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  const targetMs = Date.UTC(year, month - 1, day, hour, minute);
  return guessUtc.getTime() - (torontoMs - targetMs);
}

export function parseTorontoTime(input: string, defaultYear: number): Date | null {
  const s = input.trim().toLowerCase().replace(/,/g, "").replace(WEEKDAYS, "");

  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hour: number | undefined;
  let minute = 0;

  const ampmMatch = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const isPm = ampmMatch ? ampmMatch[3] === "pm" : false;
  const isAm = ampmMatch ? ampmMatch[3] === "am" : false;

  // ISO: 2026-05-26[ T]...
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[t\s]/);
  if (isoMatch) {
    year = parseInt(isoMatch[1]);
    month = parseInt(isoMatch[2]);
    day = parseInt(isoMatch[3]);
  }

  // Slash: 26/5 or 26/5/2026
  if (!month) {
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (slashMatch) {
      day = parseInt(slashMatch[1]);
      month = parseInt(slashMatch[2]);
      if (slashMatch[3]) year = parseInt(slashMatch[3]);
    }
  }

  // Named month: "may 26" or "may 26 2026"
  if (!month) {
    const namedMatch = s.match(/([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?/);
    if (namedMatch && MONTHS[namedMatch[1]]) {
      month = MONTHS[namedMatch[1]];
      day = parseInt(namedMatch[2]);
      if (namedMatch[3]) year = parseInt(namedMatch[3]);
    }
  }

  // Time: H:MM or HH:MM
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = parseInt(timeMatch[2]);
  } else if (ampmMatch) {
    hour = parseInt(ampmMatch[1]);
    if (ampmMatch[2]) minute = parseInt(ampmMatch[2]);
  }

  if (month === undefined || day === undefined || hour === undefined) return null;

  if (!year) year = defaultYear;

  // Normalise 12-hour clock
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  return new Date(torontoLocalToUtcMs(year, month, day, hour, minute));
}

export function formatTorontoTime(date: Date): string {
  return date.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// ── Prompts ──────────────────────────────────────────────────────────────────

export type EnrolMode = "cart" | "now" | "snipe";

export async function promptCourseSelection(
  courses: CourseSelection[],
): Promise<CourseSelection[] | null> {
  const options = courses.map((c) => ({
    value: c,
    label: c.courseCode,
    hint: c.sections.map((s) => `${s.component} ${s.section}`).join(" + "),
  }));

  const selected = await multiselect({
    message: "Which courses do you want to add to cart?",
    options,
    initialValues: courses,
    required: true,
  });

  if (isCancel(selected)) {
    cancel("Cancelled.");
    return null;
  }

  return selected as CourseSelection[];
}

export async function promptEnrolMode(): Promise<EnrolMode | null> {
  const mode = await select({
    message: "What do you want to do?",
    options: [
      { value: "cart", label: "Just add to cart" },
      { value: "now", label: "Enrol now" },
      { value: "snipe", label: "Snipe — wait for enrolment to open" },
    ],
  });

  if (isCancel(mode)) {
    cancel("Cancelled.");
    return null;
  }

  return mode as EnrolMode;
}

export async function promptSnipeTime(): Promise<number | null> {
  const defaultYear = new Date().getFullYear();

  while (true) {
    const raw = await text({
      message: 'When does enrolment open? (e.g. "May 26 8:30am", "26/5 08:30", "2026-05-26 8:30")',
      placeholder: "May 26 8:30am",
    });

    if (isCancel(raw)) {
      cancel("Cancelled.");
      return null;
    }

    const date = parseTorontoTime(raw as string, defaultYear);
    if (!date) {
      console.log(chalk.yellow("  Could not parse that date. Please try again."));
      continue;
    }

    console.log(chalk.dim(`  Sniping at ${formatTorontoTime(date)}`));
    return date.getTime();
  }
}
