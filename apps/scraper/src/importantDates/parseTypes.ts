import type * as cheerio from "cheerio";
import type { ImportantDateSection, ImportantDateTerm } from "@uoplan/core/dataTypes";

export type SourceLocale = "en" | "fr";

export type ParseImportantDatesPagesInput = {
  enHtml: string;
  frHtml: string;
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
