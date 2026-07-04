import type { Term } from "@uoplan/core";
import type { TranscriptTerm, TranscriptTermSeason } from "@uoplan/core/transcript";
import { decode } from "../../lib/term/termLabelPlain";
import type { GraphPlannerState, PlannerTermStatus } from "../../store/graphPlannerStore";

/** A future term rendered as an "enable-able" planning column. */
export interface FutureTermColumn {
  termId: string;
  enabled: boolean;
  courses: string[];
  status?: PlannerTermStatus;
}

const TRANSCRIPT_SEASON_RANK: Record<TranscriptTermSeason, number> = {
  Winter: 0,
  Summer: 1,
  Fall: 2,
};

const PEOPLESOFT_SEASON_RANK: Record<"winter" | "springSummer" | "fall", number> = {
  winter: 0,
  springSummer: 1,
  fall: 2,
};

/** Chronological sort key (higher = later) for a transcript term. */
function transcriptSortKey(term: TranscriptTerm): number {
  return term.year * 3 + (TRANSCRIPT_SEASON_RANK[term.season] ?? 0);
}

/** Chronological sort key for a PeopleSoft term id, or null when undecodable. */
function peopleSoftSortKey(termId: string): number | null {
  const decoded = decode(termId);
  if (!decoded) return null;
  return decoded.year * 3 + PEOPLESOFT_SEASON_RANK[decoded.season];
}

/**
 * The future terms the user can plan into: every term we have schedule data for
 * that falls chronologically after the last completed transcript term (all of
 * them when there's no transcript), sorted chronologically and annotated with
 * the planner store's enabled/generated state.
 */
export function computeFutureTermColumns(
  storeTerms: Term[],
  completedTerms: TranscriptTerm[],
  planner: Pick<GraphPlannerState, "enabledTermIds" | "generatedByTermId">,
): FutureTermColumn[] {
  const lastCompletedKey = completedTerms.reduce(
    (max, t) => Math.max(max, transcriptSortKey(t)),
    Number.NEGATIVE_INFINITY,
  );

  return storeTerms
    .map((t) => ({ termId: String(t.termId), key: peopleSoftSortKey(String(t.termId)) }))
    .filter((t): t is { termId: string; key: number } => t.key !== null && t.key > lastCompletedKey)
    .sort((a, b) => a.key - b.key)
    .map(({ termId }) => ({
      termId,
      enabled: planner.enabledTermIds.includes(termId),
      courses: planner.generatedByTermId[termId]?.courses ?? [],
      status: planner.generatedByTermId[termId]?.status,
    }));
}
