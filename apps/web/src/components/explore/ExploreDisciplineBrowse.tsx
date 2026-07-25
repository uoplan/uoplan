import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { useDisciplines } from "@uoplan/store/hooks";
import { tr, useTr } from "../../i18n";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { ExploreFacultyBrowse } from "./ExploreFacultyBrowse";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";

/**
 * Explore landing page for schools without registrar grade data.
 *
 * The default landing is a "spotlight" gallery ranked by grade statistics
 * (hardest, highest fail rate, …), which cannot be built without grades. Rather
 * than showing an empty page, those schools get a browsable discipline grid —
 * the same entry point, driven by data every school has.
 */
export function ExploreDisciplineBrowse({ searchParams }: { searchParams: ExploreSearchParams }) {
  useTr();
  const disciplines = useDisciplines();
  const { offeringsByCourseNorm } = useExploreOfferings();

  const rows = useMemo(() => {
    if (!disciplines) return [];
    const counts = new Map<string, number>();
    for (const norm of offeringsByCourseNorm.keys()) {
      const code = norm.split(/[\s-]/)[0]?.toUpperCase();
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return disciplines
      .map((discipline) => ({
        discipline,
        courseCount: counts.get(discipline.code.toUpperCase()) ?? 0,
      }))
      .filter((row) => row.courseCount > 0)
      .sort((a, b) => a.discipline.code.localeCompare(b.discipline.code));
  }, [disciplines, offeringsByCourseNorm]);

  return (
    <Stack gap={40} pb={80} style={{ paddingInline: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
      <ExploreFacultyBrowse searchParams={searchParams} />
      {rows.length > 0 ? (
        <Stack gap="md">
          <Text fw={600} fz="md" c="var(--app-text)">
            {tr("explore.browseByDiscipline")}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {rows.map(({ discipline, courseCount }) => (
              <SearchResultDisciplineCard
                key={discipline.code}
                discipline={discipline}
                courseCount={courseCount}
                searchParams={searchParams}
                fillWidth
              />
            ))}
          </SimpleGrid>
        </Stack>
      ) : null}
    </Stack>
  );
}
