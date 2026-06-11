import { useMemo } from "react";
import type { NormalizedCourseCode } from "@uoplan/core";
import { resolveComponentId } from "../lib/explore/gradesSearch";
import type { AliasGroups } from "../lib/explore/gradesSearch";
import { parseCoursePathParam } from "../lib/explore/courseSearchParams";

export function useCourseAliasResolution(
  urlCourseParam: string,
  aliasGroups: AliasGroups,
): {
  urlNorm: NormalizedCourseCode | null;
  componentId: NormalizedCourseCode | null;
  memberNorms: NormalizedCourseCode[];
} {
  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const componentId = useMemo(
    () => (urlNorm === null ? null : resolveComponentId(urlNorm, aliasGroups.componentByNorm)),
    [urlNorm, aliasGroups],
  );

  const memberNorms = useMemo(() => {
    if (urlNorm === null) return [];
    if (componentId === null) return [urlNorm];
    return aliasGroups.membersByComponent.get(componentId) ?? [urlNorm];
  }, [urlNorm, componentId, aliasGroups]);

  return { urlNorm, componentId, memberNorms };
}
