import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { EMPTY_EXPLORE_SEARCH } from "../lib/explore/exploreFilters";

export function useRedirectToExploreWhenNoFeedback(loading: boolean, views: readonly unknown[]) {
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (views.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, views, navigate]);
}
