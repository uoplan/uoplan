import * as cheerio from "cheerio";

export interface ParsedCourseCode {
  subject: string;
  catalogNbr: string;
  code: string;
}

export type DayOfWeek = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export interface MeetingTime {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  virtual: boolean;
  instructor: string | null;
  meetingDates: MeetingDateRange | null;
}

export type MeetingDateRange = [string, string];

export interface ComponentSection {
  section: string;
  sectionCode: string | null;
  component: string | null;
  session: string | null;
  times: MeetingTime[];
  status: string | null;
  /** Filled by grade enrichment from `grades.json` when present. */
  distribution?: Record<string, number>;
}

export interface CourseSchedule {
  subject: string;
  catalogNumber: string;
  courseCode: string;
  title: string | null;
  timeZone: string;
  components: Record<string, ComponentSection[]>;
}

const DAY_MAP: Record<string, DayOfWeek> = {
  Mo: "Mo",
  Mon: "Mo",
  Tu: "Tu",
  Tue: "Tu",
  We: "We",
  Wed: "We",
  Th: "Th",
  Thu: "Th",
  Fr: "Fr",
  Fri: "Fr",
  Sa: "Sa",
  Sat: "Sa",
  Su: "Su",
  Sun: "Su",
};

function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function parseMeetingDates(text: string): MeetingDateRange | null {
  const m = text.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  // Store as local ET dates (no offset) so consumers can combine with times using the ET timezone.
  const startDate = m[1];
  const endDate = m[2];
  if (
    Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))
  ) {
    return null;
  }
  return [startDate, endDate];
}

function parseSectionHeader(raw: string): {
  sectionCode: string | null;
  component: string | null;
  session: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { sectionCode: null, component: null, session: null };

  // Expect something like "F00-LEC FullSess."
  const m = trimmed.match(/^([A-Za-z0-9]+)-([A-Z]+)\s*(.*)$/);
  if (!m) {
    return { sectionCode: null, component: null, session: trimmed || null };
  }
  const sectionCode = m[1] || null;
  const component = m[2] || null;
  const session = m[3] ? m[3].trim() || null : null;
  return { sectionCode, component, session };
}

export function parseCourseCode(code: string): ParsedCourseCode | null {
  const m = code.match(/^([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)/);
  if (!m) return null;
  return { subject: m[1], catalogNbr: m[2], code: `${m[1]} ${m[2]}` };
}

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioSelection = ReturnType<CheerioRoot>;

function extractLines(html: string | null | undefined): string[] {
  return (html || "")
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replaceAll(/<[^>]*>/g, "")
        .replaceAll(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function extractSpanLines($row: CheerioSelection, selector: string): string[] {
  return extractLines($row.find(selector).first().html());
}

interface ParsedSectionRowParts {
  sectionLines: string[];
  dayLines: string[];
  instructorParts: string[];
  dateLines: string[];
  statusAlt: string | null;
}

function parseSectionRowParts($row: CheerioSelection): ParsedSectionRowParts {
  return {
    sectionLines: extractSpanLines($row, 'span[id^="MTG_CLASSNAME$"]'),
    dayLines: extractSpanLines($row, 'span#MTG_DAYTIME\\$0, span[id^="MTG_DAYTIME$"]'),
    instructorParts: extractSpanLines($row, 'span#MTG_INSTR\\$0, span[id^="MTG_INSTR$"]'),
    dateLines: extractSpanLines($row, 'span#MTG_TOPIC\\$0, span[id^="MTG_TOPIC$"]'),
    statusAlt:
      $row.find('div[id^="win0divDERIVED_CLSRCH_SSR_STATUS_LONG$"] img').attr("alt") || null,
  };
}

function normalizeSectionRow(
  parts: ParsedSectionRowParts,
  virtual: boolean,
): { compKey: string; section: ComponentSection } | null {
  const { sectionLines, dayLines, instructorParts, dateLines, statusAlt } = parts;
  const rawSection = sectionLines.join(" ");

  if (
    !rawSection &&
    dayLines.length === 0 &&
    instructorParts.length === 0 &&
    dateLines.length === 0 &&
    !statusAlt
  ) {
    return null;
  }

  const { sectionCode, component, session } = parseSectionHeader(sectionLines[0] || rawSection);

  const times: MeetingTime[] = [];
  for (let i = 0; i < dayLines.length; i++) {
    const line = dayLines[i];
    const m = line.match(/^([A-Za-z]{2,3})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const dayKey = DAY_MAP[m[1]];
    if (!dayKey) continue;
    const start = parseTimeToMinutes(m[2]);
    const end = parseTimeToMinutes(m[3]);
    if (start == null || end == null) continue;
    times.push({
      day: dayKey,
      startMinutes: start,
      endMinutes: end,
      virtual,
      instructor: instructorParts[i] ?? null,
      meetingDates: dateLines[i] ? parseMeetingDates(dateLines[i]) : null,
    });
  }

  const compKey = component || "UNKNOWN";
  const section: ComponentSection = {
    section: rawSection || sectionLines[0] || "",
    sectionCode,
    component,
    session,
    times,
    status: statusAlt,
  };

  return { compKey, section };
}

/** Parse a single meeting/section row into a component-keyed section, or null if the row is empty. */
function parseSectionRow(
  $row: CheerioSelection,
  virtual: boolean,
): { compKey: string; section: ComponentSection } | null {
  return normalizeSectionRow(parseSectionRowParts($row), virtual);
}

/** Build a component map from a set of meeting tables belonging to one course. */
function parseTablesIntoComponents(
  $: CheerioRoot,
  tables: CheerioSelection[],
  virtual: boolean,
): Record<string, ComponentSection[]> {
  const components: Record<string, ComponentSection[]> = {};
  for (const table of tables) {
    table.find('tr[id^="trSSR_CLSRCH_MTG1"]').each((_, row) => {
      const parsed = parseSectionRow($(row), virtual);
      if (!parsed) return;
      if (!components[parsed.compKey]) components[parsed.compKey] = [];
      components[parsed.compKey].push(parsed.section);
    });
  }
  return components;
}

/** Extract subject / catalog number / title from a course groupbox anchor title. */
function parseCourseAnchorTitle(
  title: string,
): { subject: string; catalogNbr: string; title: string | null } | null {
  // e.g. "Collapse section ITI 1120 - Introduction to Computing I"
  const m = title.match(/([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)\s*-\s*(.+)$/);
  if (!m) return null;
  return { subject: m[1], catalogNbr: m[2], title: m[3].trim() || null };
}

/**
 * Parse a PeopleSoft class-search response that may contain MANY courses (subject-level search).
 * Course groupbox anchors and their meeting tables are flat siblings, so tables are associated with
 * the most recent preceding course anchor in document order.
 */
export function parseSearchResultsHtml(html: string, virtual: boolean = false): CourseSchedule[] {
  const $ = cheerio.load(html);

  type Group = {
    subject: string;
    catalogNbr: string;
    title: string | null;
    tables: CheerioSelection[];
  };
  const groups: Group[] = [];
  let current: Group | null = null;
  let orphanTables = 0;

  // A comma selector yields matches in document order, letting us walk anchors and tables together.
  $('a[id^="SSR_CLSRSLT_WRK_GROUPBOX2$"], table[id^="SSR_CLSRCH_MTG1$scroll$"]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id") || "";
    if (id.startsWith("SSR_CLSRSLT_WRK_GROUPBOX2$")) {
      const rawTitle = $el.attr("title") ?? "";
      const parsed = parseCourseAnchorTitle(rawTitle);
      if (!parsed) {
        console.error(`Could not parse course anchor title: "${rawTitle}". Skipping its sections.`);
        current = null;
        return;
      }
      current = { ...parsed, tables: [] };
      groups.push(current);
    } else {
      // A meeting table.
      if (!current) {
        orphanTables += 1;
        return;
      }
      current.tables.push($el);
    }
  });

  if (orphanTables > 0) {
    console.error(
      `${orphanTables} meeting table(s) appeared before any course header and were ignored.`,
    );
  }

  const schedules: CourseSchedule[] = [];
  for (const group of groups) {
    const components = parseTablesIntoComponents($, group.tables, virtual);
    const totalSections = Object.values(components).reduce((sum, arr) => sum + arr.length, 0);
    if (totalSections === 0) continue;
    schedules.push({
      subject: group.subject,
      catalogNumber: group.catalogNbr,
      courseCode: `${group.subject} ${group.catalogNbr}`,
      title: group.title,
      timeZone: "America/Toronto",
      components,
    });
  }

  return schedules;
}
