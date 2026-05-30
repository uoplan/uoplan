import * as cheerio from "cheerio";
import { fetchHtml } from "../shared/http.ts";

export const ROOT_URL = "https://catalogue.uottawa.ca";

export function getCurrentAcademicYear(): number {
  const now = new Date();
  // Academic year starts in September (month index 8)
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Live catalogue site for the ongoing academic year; archives for past years only. */
export function buildBaseUrl(year: number): string {
  if (year === getCurrentAcademicYear()) return ROOT_URL;
  return `${ROOT_URL}/archive/${year}-${year + 1}`;
}

export function isArchiveBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes("/archive/");
}

/** Returns the path-only prefix for the given baseUrl (e.g. "/archive/2021-2022" or ""). */
export function hrefPrefix(baseUrl: string): string {
  return baseUrl.replace(ROOT_URL, "");
}

export function urlToSlug(url: string): string {
  return url
    .replace(/^https?:\/\/catalogue\.uottawa\.ca(?:\/archive\/\d{4}-\d{4})?\/en\//, "")
    .replace(/\/$/, "");
}

export async function scrapeDisciplineLinks(baseUrl: string): Promise<string[]> {
  const html = await fetchHtml(`${baseUrl}/en/courses/`);
  const $ = cheerio.load(html);
  const prefix = hrefPrefix(baseUrl);
  const pattern = new RegExp(`^${prefix}/en/courses/[a-z]{3,4}/$`);
  const links: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && pattern.test(href)) {
      if (!links.includes(href)) links.push(href);
    }
  });
  return links;
}

export async function scrapeProgramLinks(baseUrl: string): Promise<string[]> {
  const html = await fetchHtml(`${baseUrl}/en/programs/`);
  const $ = cheerio.load(html);
  const prefix = hrefPrefix(baseUrl);
  const links: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (
      href &&
      (href.startsWith(`${prefix}/en/undergrad/`) || href.startsWith(`${prefix}/en/graduate/`))
    ) {
      if (!links.includes(href)) links.push(href);
    }
  });
  return links;
}
