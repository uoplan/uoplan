import type * as cheerio from "cheerio";
import type { ImportantDateSection, ImportantDateTerm } from "@uoplan/core/dataTypes";

export type SourceLocale = "en" | "fr";

/** One fetched per-term page. `sourceId` is shared by the EN/FR pair of the same term. */
export type TermPageInput = {
  sourceId: string;
  sourceUrl: string;
  html: string;
};

export type ParseImportantDatesPagesInput = {
  enPages: TermPageInput[];
  frPages: TermPageInput[];
  /** Index page URLs (recorded as the dataset `sourceUrl`). */
  enSourceUrl: string;
  frSourceUrl: string;
};

export type LocalizedPage = {
  locale: SourceLocale;
  sourceUrl: string;
  reviewedText?: string;
  terms: LocalizedTerm[];
};

export type LocalizedTerm = {
  sourceId: string;
  label: string;
  sourcePublished: "true" | "false";
  sections: LocalizedSection[];
};

export type LocalizedSection = {
  label: string;
  groups: LocalizedGroup[];
};

export type LocalizedGroup = {
  label?: string;
  rows: LocalizedRow[];
};

export type LocalizedRow = {
  topic: string;
  dateText: string;
};

export type CanonicalTerm = {
  sourceId: string;
  termId: string;
  label: string;
  season: ImportantDateTerm["season"];
  year: number;
  sourcePublished: "true" | "false";
  termInterval: ImportantDateTerm["termInterval"];
  courseInterval: ImportantDateTerm["courseInterval"];
  sections: ImportantDateSection[];
  sessions: ImportantDateTerm["sessions"];
};

export type TermContext = Pick<ImportantDateTerm, "season" | "year">;
export type CheerioNode = NonNullable<Parameters<cheerio.CheerioAPI>[0]>;
