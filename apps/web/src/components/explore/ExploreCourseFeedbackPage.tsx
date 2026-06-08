import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { normalizeCourseCode } from "@uoplan/core";
import { parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { useCourseFeedbackViews } from "../../hooks/useFeedbackViews";
import { ExploreFeedbackContent } from "./feedback/ExploreFeedbackContent";

export function ExploreCourseFeedbackPage({ urlCourseParam }: { urlCourseParam: string }) {
  const { views, questions, loading, urlNorm } = useCourseFeedbackViews(urlCourseParam);
  const navigate = useNavigate();

  // Redirect to /explore if this course has no feedback once everything loads.
  useEffect(() => {
    if (loading) return;
    if (views.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, views, navigate]);

  const resolved = urlNorm ?? parseCoursePathParam(urlCourseParam);
  const title = resolved == null ? urlCourseParam.toUpperCase() : normalizeCourseCode(resolved);

  return (
    <ExploreFeedbackContent title={title} views={views} questions={questions} loading={loading} />
  );
}
