import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import { useCatalogue, useDisciplines, useFaculties } from "@uoplan/store/hooks";
import type { GradeVizData } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { useDeferredAfterPaint } from "../../hooks/useDeferredAfterPaint";
import { buildDisciplineCourseCount, buildFacultyIndexRows } from "../../lib/explore/faculty";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { aggregateGradeVizForCourseNorms } from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { SearchResultFacultyCard } from "./SearchResultFacultyCard";

/**
 * Browsable index of every faculty that owns at least one discipline with
 * catalogue courses. Search already surfaces faculties, but only if you know a
 * name to type — this is the "show me everything" entry point on the Explore
 * landing page.
 */
export function ExploreFacultyBrowse({ searchParams }: { searchParams: ExploreSearchParams }) {
  useTr();
  const { i18n } = useLingui();
  const faculties = useFaculties();
  const disciplines = useDisciplines();
  const catalogue = useCatalogue();
  const { offeringsByCourseNorm } = useExploreOfferings();
  // The grade aggregation below walks the whole offerings corpus, so it waits
  // until the page has painted; cards render with their counts in the meantime.
  const ready = useDeferredAfterPaint();

  const courseCounts = useMemo(() => buildDisciplineCourseCount(catalogue), [catalogue]);

  const rows = useMemo(
    () => buildFacultyIndexRows(faculties, disciplines, courseCounts, i18n.locale),
    [faculties, disciplines, courseCounts, i18n.locale],
  );

  const gradeVizByFaculty = useMemo(() => {
    const out = new Map<string, GradeVizData | null>();
    if (!ready || rows.length === 0 || offeringsByCourseNorm.size === 0) return out;
    const normsByPrefix = new Map<string, string[]>();
    for (const norm of offeringsByCourseNorm.keys()) {
      const prefix = norm.split(" ")[0];
      if (!prefix) continue;
      const list = normsByPrefix.get(prefix);
      if (list) list.push(norm);
      else normsByPrefix.set(prefix, [norm]);
    }
    for (const row of rows) {
      const norms: string[] = [];
      for (const prefix of row.prefixes) norms.push(...(normsByPrefix.get(prefix) ?? []));
      out.set(row.faculty.id, aggregateGradeVizForCourseNorms(offeringsByCourseNorm, norms));
    }
    return out;
  }, [ready, rows, offeringsByCourseNorm]);

  if (rows.length === 0) return null;

  return (
    <Stack gap="md">
      <Text fw={600} fz="md" c="var(--app-text)">
        {tr("explore.browseByFaculty")}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
        {rows.map((row) => (
          <SearchResultFacultyCard
            key={row.faculty.id}
            faculty={row.faculty}
            disciplineCount={row.disciplineCount}
            courseCount={row.courseCount}
            gradeViz={gradeVizByFaculty.get(row.faculty.id) ?? null}
            searchParams={searchParams}
            fillWidth
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
