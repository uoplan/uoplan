import { useEffect } from "react";
import { courseSentimentByNorm } from "@uoplan/core";
import { useAppStore } from "../store/appStore";
import { useFeedbackData } from "./useFeedbackData";

/**
 * Lazily loads the course-feedback dataset and publishes the per-course overall
 * sentiment map into the store whenever the "prefer higher sentiment" generation
 * option is enabled. The map is consumed by schedule generation to bias pool
 * picks toward higher-feedback courses. Cleared when the option is off so we
 * never pass stale weights to the engine.
 */
export function useGenerationSentiment(): void {
  const enabled = useAppStore((s) => s.generationPreferHigherSentiment);
  const setCourseSentimentByNorm = useAppStore((s) => s.setCourseSentimentByNorm);
  const { data: feedbackIndex } = useFeedbackData(enabled);

  useEffect(() => {
    if (!enabled) {
      setCourseSentimentByNorm(null);
      return;
    }
    if (feedbackIndex) {
      setCourseSentimentByNorm(courseSentimentByNorm(feedbackIndex));
    }
  }, [enabled, feedbackIndex, setCourseSentimentByNorm]);
}
