import type {
  ImportantDateCategory,
  ImportantDateEffect,
  ImportantDateInterval,
  ImportantDateTerm,
  ScheduleReplacement,
} from "@uoplan/core/dataTypes";

export type ImportantDateParseContext = Pick<ImportantDateTerm, "season" | "year">;

export type ScheduleReplacementParseResult =
  | { kind: "parsed"; replacement: ScheduleReplacement }
  | { kind: "not_applicable" }
  | { kind: "unsupported" };

const MONTH_NUMBERS: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const WEEKDAY_CODES: Readonly<Record<string, ScheduleReplacement["sourceDay"]>> = {
  monday: "Mo",
  tuesday: "Tu",
  wednesday: "We",
  thursday: "Th",
  friday: "Fr",
  saturday: "Sa",
  sunday: "Su",
};

const UNDATED_MARKERS = new Set([
  "n/a",
  "na",
  "none",
  "consult your faculty or unit",
  "consult your facuty or unit",
  "consult the u-pass website",
]);

const DATE_TEXT_PATTERN = "[A-Za-z]+ \\d{1,2}(?:,? \\d{4})?";
const CLOCK_TIME_PATTERN = "\\d{1,2}(?::\\d{2})? (?:a|p)\\.m\\.?";
const DATE_RE = new RegExp(`^(?<date>${DATE_TEXT_PATTERN})$`, "i");
const DATE_RANGE_RE = new RegExp(
  `^(?<startDate>${DATE_TEXT_PATTERN}) to (?<endDate>${DATE_TEXT_PATTERN})$`,
  "i",
);
const SAME_MONTH_RANGE_RE = new RegExp(
  "^(?<month>[A-Za-z]+) (?<startDay>\\d{1,2}) to (?<endDay>\\d{1,2})(?:, (?<year>\\d{4}))?$",
  "i",
);
const SINGLE_START_TIME_RE = new RegExp(
  `^(?<date>${DATE_TEXT_PATTERN}),? starting at (?<time>${CLOCK_TIME_PATTERN})$`,
  "i",
);
const SINGLE_MIDNIGHT_RE = new RegExp(
  `^(?<date>${DATE_TEXT_PATTERN}), one minute past midnight$`,
  "i",
);
const TIMED_RANGE_RE = new RegExp(
  `^From (?<startTime>${CLOCK_TIME_PATTERN}) (?<startDate>${DATE_TEXT_PATTERN}), to (?<endTime>${CLOCK_TIME_PATTERN}) (?<endDate>${DATE_TEXT_PATTERN})$`,
  "i",
);

const SCHEDULE_REPLACEMENT_PATTERNS = [
  new RegExp(
    `^Classes on (?<cancelledWeekday>[A-Za-z]+), (?<cancelledDate>${DATE_TEXT_PATTERN}).*? are cancelled\\. They will (?:take place|be held) on (?:(?<replacementWeekday>[A-Za-z]+), )?(?<replacementDate>${DATE_TEXT_PATTERN})(?:,? when the usual (?<sourceWeekday>[A-Za-z]+) course schedule will apply)?\\.?` +
      "(?: .+)?$",
    "i",
  ),
  new RegExp(
    `^Classes are cancelled on (?<cancelledWeekday>[A-Za-z]+), (?<cancelledDate>${DATE_TEXT_PATTERN}).*?\\. They will (?:take place|be held) on (?:(?<replacementWeekday>[A-Za-z]+), )?(?<replacementDate>${DATE_TEXT_PATTERN})(?:,? when the usual (?<sourceWeekday>[A-Za-z]+) course schedule will apply)?\\.?` +
      "(?: .+)?$",
    "i",
  ),
] as const;

export function isUndatedImportantDateText(text: string): boolean {
  return UNDATED_MARKERS.has(normalizeUndatedMarker(text));
}

export function parseImportantDateInterval(
  text: string,
  context: ImportantDateParseContext,
): ImportantDateInterval | null {
  const normalized = stripTrailingTermLabel(normalizeImportantDatesText(text));
  if (!normalized || isUndatedImportantDateText(normalized)) {
    return null;
  }

  const timedRange = TIMED_RANGE_RE.exec(normalized)?.groups;
  if (timedRange) {
    return createInterval(
      parseDateText(timedRange.startDate, context),
      parseDateText(timedRange.endDate, context),
      parseClockMinutes(timedRange.startTime),
      parseClockMinutes(timedRange.endTime),
    );
  }

  const singleStartTime = SINGLE_START_TIME_RE.exec(normalized)?.groups;
  if (singleStartTime) {
    const date = parseDateText(singleStartTime.date, context);
    return createInterval(date, date, parseClockMinutes(singleStartTime.time));
  }

  const singleMidnight = SINGLE_MIDNIGHT_RE.exec(normalized)?.groups;
  if (singleMidnight) {
    const date = parseDateText(singleMidnight.date, context);
    return createInterval(date, date, 1);
  }

  const sameMonthRange = SAME_MONTH_RANGE_RE.exec(normalized)?.groups;
  if (sameMonthRange) {
    return createInterval(
      parseMonthDayText(
        sameMonthRange.month,
        sameMonthRange.startDay,
        sameMonthRange.year,
        context,
      ),
      parseMonthDayText(sameMonthRange.month, sameMonthRange.endDay, sameMonthRange.year, context),
    );
  }

  const dateRange = DATE_RANGE_RE.exec(normalized)?.groups;
  if (dateRange) {
    return createInterval(
      parseDateText(dateRange.startDate, context),
      parseDateText(dateRange.endDate, context),
    );
  }

  const singleDate = DATE_RE.exec(normalized)?.groups;
  if (singleDate) {
    const date = parseDateText(singleDate.date, context);
    return createInterval(date, date);
  }

  return null;
}

export function parseScheduleReplacement(
  text: string,
  context: ImportantDateParseContext,
): ScheduleReplacementParseResult {
  const normalized = normalizeImportantDatesText(text);
  if (!normalized || isUndatedImportantDateText(normalized)) {
    return { kind: "not_applicable" };
  }

  for (const pattern of SCHEDULE_REPLACEMENT_PATTERNS) {
    const groups = pattern.exec(normalized)?.groups;
    if (!groups) {
      continue;
    }

    const cancelledDay = parseWeekdayCode(groups.cancelledWeekday);
    const cancelledDate = parseDateText(groups.cancelledDate, context);
    assertWeekdayMatches(cancelledDate, cancelledDay, "cancelled weekday");

    if (groups.sourceWeekday) {
      const sourceDay = parseWeekdayCode(groups.sourceWeekday);
      if (sourceDay !== cancelledDay) {
        throw new Error(
          `Usual course schedule weekday must match cancelled weekday: ${groups.sourceWeekday}`,
        );
      }
    }

    const replacementDate = parseDateText(groups.replacementDate, context);
    if (groups.replacementWeekday) {
      assertWeekdayMatches(
        replacementDate,
        parseWeekdayCode(groups.replacementWeekday),
        "replacement weekday",
      );
    }

    return {
      kind: "parsed",
      replacement: {
        cancelledDate,
        replacementDate,
        sourceDay: cancelledDay,
      },
    };
  }

  return { kind: "unsupported" };
}

export function classifyImportantDateEffect(input: {
  category: ImportantDateCategory;
  topic: string;
  dateText: string;
  scheduleReplacement?: ScheduleReplacement | null;
}): ImportantDateEffect {
  switch (input.category) {
    case "overview": {
      return "structural";
    }
    case "schedule_changes": {
      return input.scheduleReplacement ? "schedule_replacement" : "informational";
    }
    case "breaks": {
      return isRegularScheduleNotice(input.topic, input.dateText) ? "informational" : "no_classes";
    }
    default: {
      return "deadline";
    }
  }
}

function normalizeImportantDatesText(text: string): string {
  return text
    .replaceAll(/[\u00A0\u202F]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeUndatedMarker(text: string): string {
  return normalizeImportantDatesText(text).replace(/\.+$/, "").toLowerCase();
}

function stripTrailingTermLabel(text: string): string {
  return text.replace(/\s+in\s+(?:Winter|Spring-Summer|Fall)\s+\d{4}$/i, "");
}

function parseDateText(text: string, context: ImportantDateParseContext): string {
  const match = /^(?<month>[A-Za-z]+) (?<day>\d{1,2})(?:,? (?<year>\d{4}))?$/i.exec(text)?.groups;
  if (!match) {
    throw new Error(`Unsupported date text: ${text}`);
  }

  return parseMonthDayText(match.month, match.day, match.year, context);
}

function parseMonthDayText(
  monthText: string,
  dayText: string,
  explicitYearText: string | undefined,
  context: ImportantDateParseContext,
): string {
  const month = MONTH_NUMBERS[monthText.toLowerCase()];
  if (!month) {
    throw new Error(`Unsupported month: ${monthText}`);
  }

  const day = Number.parseInt(dayText, 10);
  const year = explicitYearText
    ? Number.parseInt(explicitYearText, 10)
    : inferYearForMonth(context.season, context.year, month);

  return createDateString(year, month, day);
}

function inferYearForMonth(
  season: ImportantDateParseContext["season"],
  year: number,
  month: number,
): number {
  switch (season) {
    case "winter": {
      return month <= 7 ? year : year - 1;
    }
    case "spring-summer": {
      return year;
    }
    case "fall": {
      return month <= 4 ? year + 1 : year;
    }
  }
}

function createDateString(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${year}-${pad(month)}-${pad(day)}`);
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

function createInterval(
  startDate: string,
  endDate: string,
  startMinutes?: number,
  endMinutes?: number,
): ImportantDateInterval {
  if (
    startDate > endDate ||
    (startDate === endDate &&
      startMinutes !== undefined &&
      endMinutes !== undefined &&
      startMinutes > endMinutes)
  ) {
    throw new Error(
      `Important date interval start must not be after end: ${startDate} > ${endDate}`,
    );
  }

  return {
    startDate,
    endDate,
    ...(startMinutes !== undefined ? { startMinutes } : {}),
    ...(endMinutes !== undefined ? { endMinutes } : {}),
  };
}

function parseClockMinutes(text: string): number {
  const match = /^(?<hour>\d{1,2})(?::(?<minute>\d{2}))? (?<period>a|p)\.m\.?$/i.exec(text)?.groups;
  if (!match) {
    throw new Error(`Unsupported time text: ${text}`);
  }

  const hour = Number.parseInt(match.hour, 10);
  const minute = Number.parseInt(match.minute ?? "0", 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error(`Unsupported time text: ${text}`);
  }

  const normalizedHour = (hour % 12) + (match.period.toLowerCase() === "p" ? 12 : 0);
  return normalizedHour * 60 + minute;
}

function parseWeekdayCode(text: string): ScheduleReplacement["sourceDay"] {
  const weekday = WEEKDAY_CODES[text.toLowerCase()];
  if (!weekday) {
    throw new Error(`Unsupported weekday: ${text}`);
  }
  return weekday;
}

function assertWeekdayMatches(
  dateString: string,
  expected: ScheduleReplacement["sourceDay"],
  label: string,
): void {
  const actual = weekdayFromDateString(dateString);
  if (actual !== expected) {
    throw new Error(`${capitalize(label)} does not match ${dateString}`);
  }
}

function weekdayFromDateString(dateString: string): ScheduleReplacement["sourceDay"] {
  const [yearText, monthText, dayText] = dateString.split("-");
  const utc = new Date(
    Date.UTC(
      Number.parseInt(yearText, 10),
      Number.parseInt(monthText, 10) - 1,
      Number.parseInt(dayText, 10),
    ),
  );

  switch (utc.getUTCDay()) {
    case 0:
      return "Su";
    case 1:
      return "Mo";
    case 2:
      return "Tu";
    case 3:
      return "We";
    case 4:
      return "Th";
    case 5:
      return "Fr";
    case 6:
      return "Sa";
    default:
      throw new Error(`Unsupported weekday index for ${dateString}`);
  }
}

function isRegularScheduleNotice(topic: string, dateText: string): boolean {
  const combined = `${topic} ${dateText}`.toLowerCase();
  return combined.includes("online") && combined.includes("follow the regular schedule");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
