import type { AliasGroups } from "@uoplan/core/courseAlias";
import type { Catalogue, SchedulesData } from "@uoplan/core/dataTypes";
import type { FeedbackIndex } from "@uoplan/core/feedback";
import type { GradeVizData } from "@uoplan/core/gradeDistribution";

import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { feedbackHeadline, feedbackViewsForCourse } from "@/data/feedback-data";

import { courseDetail, courseScheduleTerms } from "./explore-detail";
import {
  exploreCourseLanguage,
  exploreCourseLevel,
  type AppDataBundle,
  type ExploreCourseLanguage,
  type ExploreCourseLevel,
  type ExploreIndex,
} from "./explore-index";
import { formatTermLabel } from "./trends-data";

export interface CourseCompareModel {
  code: string;
  title: string;
  credits: number | null;
  facultyName: string | null;
  level: ExploreCourseLevel | null;
  language: ExploreCourseLanguage | null;
  prerequisites: string | null;
  terms: string[];
  gradeViz: GradeVizData | null;
  averageGpa: number | null;
  passingPercent: number | null;
  topProfessorRating: number | null;
  sentiment: number | null;
}

export interface BuildCourseCompareModelsInput {
  bundle: AppDataBundle;
  index: ExploreIndex;
  schedulesByTerm: ReadonlyMap<string, SchedulesData>;
  feedback: FeedbackIndex;
  aliasGroups: AliasGroups | null;
  ids: readonly string[];
}

function catalogueCourseByCode(catalogue: Catalogue, code: string) {
  const normalized = normalizeCourseCode(code);
  return (
    catalogue.courses.find((course) => normalizeCourseCode(course.code) === normalized) ?? null
  );
}

function formatStructuredPrereq(
  node: NonNullable<ReturnType<typeof catalogueCourseByCode>>["prerequisites"],
): string | null {
  if (!node) return null;
  if (node.text?.trim()) return node.text.trim();
  if (node.type === "course" && node.code) return normalizeCourseCode(node.code);
  const children = node.children
    ?.map(formatStructuredPrereq)
    .filter((text): text is string => !!text);
  if (children && children.length > 0) {
    return children.join(node.type === "or_group" ? " / " : " + ");
  }
  return null;
}

function coursePrerequisites(
  course: NonNullable<ReturnType<typeof catalogueCourseByCode>> | null,
): string | null {
  if (!course) return null;
  if (course.prereqText?.trim()) return course.prereqText.trim();
  return formatStructuredPrereq(course.prerequisites);
}

function facultyNameFor(bundle: AppDataBundle, disciplineCode: string): string | null {
  const discipline = bundle.disciplines.find(
    (entry) => entry.code.toUpperCase() === disciplineCode.toUpperCase(),
  );
  if (!discipline?.facultyId) return null;
  return bundle.faculties.find((entry) => entry.id === discipline.facultyId)?.name ?? null;
}

function topRating(values: ReadonlyArray<number | null | undefined>): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    best = best == null ? value : Math.max(best, value);
  }
  return best;
}

function normalizedIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const normalized = normalizeCourseCode(id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function buildCourseCompareModels({
  bundle,
  index,
  schedulesByTerm,
  feedback,
  aliasGroups,
  ids,
}: BuildCourseCompareModelsInput): CourseCompareModel[] {
  return normalizedIds(ids).flatMap((id) => {
    const detail = courseDetail(bundle, index, id, aliasGroups);
    if (!detail) return [];

    const catalogueCourse = catalogueCourseByCode(bundle.catalogue, detail.course.code);
    const headline = feedbackHeadline(feedbackViewsForCourse(feedback, detail.course.code));

    return [
      {
        code: detail.course.code,
        title: detail.course.title,
        credits: catalogueCourse?.credits ?? null,
        facultyName: facultyNameFor(bundle, detail.course.discipline),
        level: exploreCourseLevel(detail.course.code),
        language: exploreCourseLanguage(detail.course.code),
        prerequisites: coursePrerequisites(catalogueCourse),
        terms: courseScheduleTerms(schedulesByTerm, detail.course.code).map(formatTermLabel),
        gradeViz: detail.course.gradeViz,
        averageGpa: detail.course.gpa,
        passingPercent: detail.course.gradeViz?.passingPercent ?? null,
        topProfessorRating: topRating(detail.professors.map((professor) => professor.rating)),
        sentiment: headline.satisfaction,
      },
    ];
  });
}
