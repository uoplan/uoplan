import type { CarletonSearchForm } from "./parseSearchFields.ts";
import { parseSearchForm, parseSearchPostFields } from "./parseSearchFields.ts";
import { parseTerms } from "./parseTerms.ts";

const DEFAULT_BASE_URL = "https://central.carleton.ca/prod/";
const DEFAULT_USER_AGENT =
  "uoplan-scraper/1.0 (+https://uoplan.party; Carleton Banner schedule data)";

export interface CarletonBannerClientOptions {
  baseUrl?: string;
  delayMs?: number;
  backoffMs?: number;
  retries?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  searchForm?: CarletonSearchForm;
}

export interface CarletonCourseSearchRequest {
  term: string;
  sessionId: string;
  subject: string;
}

export class CarletonBannerClient {
  private readonly baseUrl: URL;
  private readonly delayMs: number;
  private readonly backoffMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly searchForm?: CarletonSearchForm;
  private readonly cookies = new Map<string, string>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: CarletonBannerClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL);
    this.delayMs = options.delayMs ?? 1000;
    this.backoffMs = options.backoffMs ?? 1000;
    this.retries = options.retries ?? 3;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.searchForm = options.searchForm;
  }

  async fetchSelectTerm(): Promise<string> {
    return this.request("bwysched.p_select_term?wsea_code=EXT");
  }

  async fetchSearchFields(term: string, sessionId?: string): Promise<string> {
    const resolvedSessionId = sessionId ?? parseTerms(await this.fetchSelectTerm()).sessionId;
    const params = new URLSearchParams({
      wsea_code: "EXT",
      term_code: term,
      session_id: resolvedSessionId,
    });
    return this.request(`bwysched.p_search_fields?${params.toString()}`);
  }

  async fetchSubjects(term: string): Promise<string> {
    const params = new URLSearchParams({ wsea_code: "EXT", term_code: term, levl_code: "UG" });
    return this.request(`bwysched.p_search_subj_op?${params.toString()}`);
  }

  async searchCourses(request: CarletonCourseSearchRequest): Promise<string> {
    const fieldsHtml = this.searchForm
      ? null
      : await this.fetchSearchFields(request.term, request.sessionId);
    const searchForm = this.searchForm ?? parseSearchForm(fieldsHtml ?? "");
    const bodyFields = fieldsHtml ? parseSearchPostFields(fieldsHtml) : searchForm.hiddenFields;
    const body = new URLSearchParams(
      bodyFields.filter(([name, value]) => !(name === "sel_subj" && value === "")),
    );
    if (!body.has("sel_number")) body.append("sel_number", "");
    if (!body.has("sel_crn")) body.append("sel_crn", "");
    body.append("sel_subj", request.subject);

    return this.request(searchForm.action || "bwysched.p_course_search", {
      body,
      method: "POST",
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<string> {
    const previous = this.queue;
    let release = (): void => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.throttledFetch(path, init);
    } finally {
      release();
    }
  }

  private async throttledFetch(path: string, init: RequestInit): Promise<string> {
    await this.waitForTurn();
    const url = new URL(path, this.baseUrl);
    const headers = {
      "User-Agent": this.userAgent,
      ...(init.body instanceof URLSearchParams
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
      ...Object.fromEntries(new Headers(init.headers).entries()),
    };

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const response = await this.fetchImpl(url, { ...init, headers });
      this.storeCookies(response.headers);
      if (response.ok) return response.text();
      if (response.status < 500 || attempt === this.retries) {
        throw new Error(
          `Carleton Banner request failed (${response.status}) for ${url.toString()}`,
        );
      }
      await sleep(this.backoffMs * (attempt + 1));
    }

    throw new Error(`Carleton Banner request failed for ${url.toString()}`);
  }

  private cookieHeader(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  private storeCookies(headers: Headers): void {
    const cookieHeaders = readSetCookieHeaders(headers);
    for (const header of cookieHeaders) {
      const [pair] = header.split(";");
      const separator = pair?.indexOf("=") ?? -1;
      if (!pair || separator <= 0) continue;
      this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }

  private async waitForTurn(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = Math.max(0, this.delayMs - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    this.lastRequestAt = Date.now();
  }
}

function readSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = withGetSetCookie.getSetCookie?.();
  if (setCookies && setCookies.length > 0) return setCookies;
  const header = headers.get("set-cookie");
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
