import * as cheerio from "cheerio";

const CARLETON_CALENDAR_ROOT = "https://calendar.carleton.ca";

export type CarletonCalendarClientOptions = {
  delayMs?: number;
  /**
   * Requests allowed in flight at once. CourseLeaf is a static, CDN-backed site
   * with no session state, so a small pool is safe and cuts a full-catalogue
   * scrape from minutes to seconds. Defaults to 1 (fully serialized).
   */
  concurrency?: number;
  retries?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildCalendarPath(path: string, year?: string): string {
  const normalized = normalizePath(path);
  if (!year) return `${CARLETON_CALENDAR_ROOT}${normalized}`;
  return `${CARLETON_CALENDAR_ROOT}/calendars/${year}${normalized}`;
}

export function subjectCoursesUrl(subject: string, year?: string): string {
  return buildCalendarPath(`/undergrad/courses/${subject.toUpperCase()}/`, year);
}

export function programPageUrl(slug: string, year?: string): string {
  return buildCalendarPath(
    `/undergrad/undergradprograms/${slug.replaceAll(/^\/+|\/+$/g, "")}/`,
    year,
  );
}

/**
 * Subject codes on Carleton's course index are **plain text**, not links: the
 * page reads `Computer Science ( COMP )` and `Architecture ( ARCS, ARCC, ARCN,
 * ARCH, ARCU )` — one entry can name several subjects that share a page, and
 * only a handful of entries are hyperlinked at all. So the codes are read out of
 * the parenthesised text and each is fetched at `/undergrad/courses/{CODE}/`,
 * with any genuine `/undergrad/courses/<CODE>/` hrefs folded in as a safety net.
 */
export function parseSubjectIndex(html: string): string[] {
  const $ = cheerio.load(html);
  const subjects = new Set<string>();

  $('a[href*="/undergrad/courses/"]').each((_, link) => {
    const href = $(link).attr("href") ?? "";
    const match = href.match(/\/undergrad\/courses\/([A-Za-z]{2,5})\//);
    if (match) subjects.add(match[1].toUpperCase());
  });

  // `#textcontainer` is CourseLeaf's main content region; falling back to the
  // whole document keeps this working if the wrapper id ever changes.
  const container = $("#textcontainer");
  const text = container.length > 0 ? container.text() : $.root().text();
  for (const group of text.matchAll(/\(\s*([A-Z]{2,5}(?:\s*,\s*[A-Z]{2,5})*)\s*\)/g)) {
    for (const code of group[1].split(",")) subjects.add(code.trim());
  }

  subjects.delete("PDF");
  return Array.from(subjects).sort();
}

export function parseProgramIndex(html: string): string[] {
  const $ = cheerio.load(html);
  const slugs = new Set<string>();
  $('a[href*="/undergrad/undergradprograms/"]').each((_, link) => {
    const href = $(link).attr("href") ?? "";
    const match = href.match(/\/undergrad\/undergradprograms\/([^/#?]+)\/?/);
    if (match) slugs.add(match[1]);
  });
  return Array.from(slugs).sort();
}

export function parseArchiveYears(html: string): string[] {
  const years = new Set<string>();
  for (const match of html.matchAll(/\/calendars\/(\d{4}-\d{4})\//g)) {
    years.add(match[1]);
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CarletonCalendarClient {
  private readonly delayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly concurrency: number;
  private inFlight = 0;
  private readonly waiters: (() => void)[] = [];
  private lastRequestAt = 0;

  constructor(options: CarletonCalendarClientOptions = {}) {
    this.delayMs = options.delayMs ?? 500;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.retries = options.retries ?? 3;
    this.userAgent =
      options.userAgent ??
      "uoplan-catalogue-scraper/1.0 (Carleton CourseLeaf; contact: https://uoplan.party)";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  // Consumed through the structural `CarletonCalendarLike` interface in
  // scrapeCatalogue.ts / schedules.ts, which fallow's class-member analysis
  // cannot follow.
  // fallow-ignore-next-line unused-class-member
  fetchSubjectIndex(year?: string): Promise<string> {
    return this.fetchText(buildCalendarPath("/undergrad/courses/", year));
  }

  fetchUndergradProgramsIndex(year?: string): Promise<string> {
    return this.fetchText(buildCalendarPath("/undergrad/undergradprograms/", year));
  }

  fetchSubjectCourses(subject: string, year?: string): Promise<string> {
    return this.fetchText(subjectCoursesUrl(subject, year));
  }

  fetchProgramPage(slug: string, year?: string): Promise<string> {
    return this.fetchText(programPageUrl(slug, year));
  }

  /** Acquire a slot, waiting until fewer than `concurrency` requests are active. */
  private async acquire(): Promise<void> {
    if (this.inFlight < this.concurrency) {
      this.inFlight += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inFlight += 1;
  }

  private release(): void {
    this.inFlight -= 1;
    this.waiters.shift()?.();
  }

  private async fetchText(url: string): Promise<string> {
    await this.acquire();
    try {
      return await this.performFetch(url);
    } finally {
      this.release();
    }
  }

  private async performFetch(url: string): Promise<string> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs - elapsed));
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      this.lastRequestAt = Date.now();
      try {
        const response = await this.fetchImpl(url, { headers: { "User-Agent": this.userAgent } });
        if (response.ok) return await response.text();
        if (response.status >= 500 && attempt < this.retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
      } catch (error: unknown) {
        lastError = error;
        if (attempt >= this.retries - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw new Error(`Failed to fetch ${url}: ${getErrorMessage(lastError)}`);
  }
}
