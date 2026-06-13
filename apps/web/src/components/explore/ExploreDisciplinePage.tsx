import { Badge, Box, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import type { Catalogue, Discipline, Faculty, ProfessorRatingsMap } from "@uoplan/core";
import { localizeFacultyName } from "../../lib/explore/faculty";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { DisciplineCourseList } from "./DisciplineCourseList";

export function ExploreDisciplinePage({
  disciplineCode,
  disciplines,
  faculties,
  catalogue,
  professorRatings,
}: {
  disciplineCode: string;
  disciplines: Discipline[] | null;
  faculties: Faculty[] | null;
  catalogue: Catalogue | null;
  professorRatings: ProfessorRatingsMap | null;
}) {
  const { i18n } = useLingui();
  const navigate = useNavigate();

  const normalizedCode = disciplineCode.toUpperCase();

  const discipline = useMemo(() => {
    if (!disciplines) return null;
    return disciplines.find((d) => d.code.toUpperCase() === normalizedCode) ?? null;
  }, [disciplines, normalizedCode]);

  // Navigate to /explore if discipline code is not found once data loads
  useEffect(() => {
    if (disciplines === null) return; // still loading
    if (discipline === null) {
      void navigate({
        to: "/explore",
        search: EMPTY_EXPLORE_SEARCH,
        replace: true,
      });
    }
  }, [disciplines, discipline, navigate]);

  const isFr = i18n.locale.startsWith("fr");
  const displayName = discipline
    ? isFr
      ? (discipline.nameFr ?? discipline.name)
      : discipline.name
    : null;

  // Prefer the canonical code from the data (already uppercased), fall back to the URL param
  const titleCode = discipline?.code ?? normalizedCode;

  const faculty = useMemo(() => {
    if (!discipline?.facultyId || !faculties) return null;
    return faculties.find((f) => f.id === discipline.facultyId) ?? null;
  }, [discipline, faculties]);
  const facultyName = faculty ? localizeFacultyName(faculty, i18n.locale) : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        {discipline ? (
          <Box
            pt={4}
            pb={32}
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
            }}
          >
            <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
              {titleCode}
            </Title>
            {displayName ? (
              <Text size="sm" c="dimmed" lh={1.5} mt={8}>
                {displayName}
              </Text>
            ) : null}
            {faculty && facultyName ? (
              <Badge
                size="lg"
                variant="light"
                color="gray"
                radius="sm"
                mt={10}
                maw="100%"
                style={{ textTransform: "none", cursor: "pointer" }}
                renderRoot={(props) => (
                  <Link
                    to="/explore/faculty/$faculty"
                    params={{ faculty: faculty.id }}
                    search={EMPTY_EXPLORE_SEARCH}
                    {...props}
                  />
                )}
              >
                {facultyName}
              </Badge>
            ) : null}
          </Box>
        ) : null}

        <DisciplineCourseList
          disciplineCode={normalizedCode}
          catalogue={catalogue}
          professorRatings={professorRatings}
        />
      </Stack>
    </m.div>
  );
}
