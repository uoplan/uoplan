import { useMemo } from "react";
import { courseSentimentByNorm, professorSentimentByName } from "@uoplan/core";
import { useFeedbackData } from "./useFeedbackData";

export interface ScheduleSentimentMaps {
  courseByNorm: Map<string, number> | null;
  professorByName: Map<string, number> | null;
}

const EMPTY: ScheduleSentimentMaps = { courseByNorm: null, professorByName: null };

/**
 * Lazily loads the course-evaluation dataset and derives the per-course and
 * per-professor overall sentiment maps (1-5) used to surface satisfaction on
 * calendar events. Returns empty maps until the (~900 KB) dataset has loaded, so
 * the schedule renders immediately and the numbers fill in afterwards.
 */
export function useScheduleSentiment(enabled = true): ScheduleSentimentMaps {
  const { data: feedback } = useFeedbackData(enabled);
  return useMemo(() => {
    if (!enabled || !feedback) return EMPTY;
    return {
      courseByNorm: courseSentimentByNorm(feedback),
      professorByName: professorSentimentByName(feedback),
    };
  }, [enabled, feedback]);
}
