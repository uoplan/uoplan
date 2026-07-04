export interface TextItemWithPosition {
  str: string;
  x: number;
  y: number;
}

export interface PdfPageText {
  pageText: string;
  itemsWithPosition: TextItemWithPosition[];
  hasPosition: boolean;
}

/** Normalized academic season for a transcript term. "Spring/Summer" collapses to "Summer". */
export type TranscriptTermSeason = "Winter" | "Summer" | "Fall";

/**
 * A single term block parsed from a transcript, grouping the courses that were
 * completed in that term. Purely descriptive history (no PeopleSoft term code):
 * these are the left-hand "completed" bands in the degree planner.
 */
export interface TranscriptTerm {
  /** Display label as it appeared on the transcript, e.g. "2022 Fall Term". */
  label: string;
  /** Calendar year the term header names (e.g. 2022). */
  year: number;
  /** Normalized season used for chronological ordering. */
  season: TranscriptTermSeason;
  /** Normalized course codes completed in this term, in transcript order. */
  courses: string[];
}
