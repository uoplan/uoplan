import { normalizeCourseCode } from "@uoplan/core";
import { parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import { useCourseFeedbackViews } from "../../hooks/useFeedbackViews";
import { useRedirectToExploreWhenNoFeedback } from "../../hooks/useRedirectToExploreWhenNoFeedback";
import { ExploreFeedbackContent } from "./feedback/ExploreFeedbackContent";

export function ExploreCourseFeedbackPage({ urlCourseParam }: { urlCourseParam: string }) {
  const { views, questions, loading, urlNorm } = useCourseFeedbackViews(urlCourseParam);
  useRedirectToExploreWhenNoFeedback(loading, views);

  const resolved = urlNorm ?? parseCoursePathParam(urlCourseParam);
  const title = resolved == null ? urlCourseParam.toUpperCase() : normalizeCourseCode(resolved);

  return (
    <ExploreFeedbackContent title={title} views={views} questions={questions} loading={loading} />
  );
}
