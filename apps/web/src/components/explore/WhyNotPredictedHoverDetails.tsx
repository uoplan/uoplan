import { useMemo } from "react";
import { Box } from "@mantine/core";
import type { NormalizedCourseCode } from "@uoplan/core";
import { explainUnpredictedInstructorsForCourse, normalizeCourseCode } from "@uoplan/core";
import { useTr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useTermScheduleData } from "../../hooks/useTermScheduleData";
import { useProfessorRegistry } from "@uoplan/store/hooks";
import { UnpredictedInstructorList } from "./UnpredictedInstructorList";

/** Cap on the number of excluded professors listed in the predicted-badge card. */
const MAX_REASONS = 6;

/**
 * Course/term-level "why aren't the other professors predicted?" detail, rendered
 * inside the Explore predicted-badge HoverCard. Lazily loads the term schedule and
 * grade history on hover (the HoverCard dropdown only mounts when opened), then
 * explains, for every historical instructor of the course who isn't a prediction,
 * why the build-time predictor dropped them (time conflict, stale, not teaching
 * this term, ranked below the cap). Renders nothing while loading or when there's
 * nothing to explain.
 */
export function WhyNotPredictedHoverDetails({
  courseCode,
  termId,
}: {
  courseCode: NormalizedCourseCode;
  termId: number;
}) {
  useTr();
  const registry = useProfessorRegistry();
  const { data: schedulesData } = useTermScheduleData(termId);
  const { data: courseGrades } = useCourseGradesPb();

  const items = useMemo(() => {
    if (!schedulesData) return [];
    const course = schedulesData.schedules.find(
      (s) => normalizeCourseCode(s.courseCode) === courseCode,
    );
    if (!course) return [];
    const grades = courseGrades?.courses.find((c) => c.code === courseCode)?.sections ?? [];
    if (grades.length === 0) return [];
    return explainUnpredictedInstructorsForCourse({
      courseCode,
      course,
      termSchedules: schedulesData.schedules,
      termId,
      courseGrades: grades,
      maxReasons: MAX_REASONS,
    });
  }, [schedulesData, courseGrades, courseCode, termId]);

  if (items.length === 0) return null;

  return (
    <Box mt={6} pt={6} style={{ borderTop: "var(--app-border-width) solid var(--app-border)" }}>
      <UnpredictedInstructorList items={items} registry={registry} />
    </Box>
  );
}
