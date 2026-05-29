import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Box, Text } from "@mantine/core";
import { useShallow } from "zustand/react/shallow";
import { ExploreProfessorPage } from "../../../components/explore/ExploreProfessorPage";
import { tr } from "../../../i18n";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/professor/$legacyId")({
  head: ({ params }) => {
    const id = Number.parseInt(params.legacyId, 10);
    const isNumeric = Number.isFinite(id) && id > 0;
    const title = isNumeric ? "Professor" : decodeURIComponent(params.legacyId);
    return { meta: [{ title }] };
  },
  component: ExploreProfessorRoute,
});

function ExploreProfessorRoute() {
  const { legacyId } = Route.useParams();
  const parsed = Number.parseInt(legacyId, 10);
  const isNumeric = Number.isFinite(parsed) && parsed > 0;

  const courseGrades = useAppStore((s) => s.courseGrades);

  useEffect(() => {
    if (!isNumeric || !courseGrades) return;
    for (const course of courseGrades.courses) {
      for (const prof of course.professors) {
        if (prof.legacyId === parsed) {
          document.title = prof.name;
          return;
        }
      }
    }
  }, [isNumeric, parsed, courseGrades]);

  const professorRatings = useAppStore(useShallow((s) => s.professorRatings));

  if (isNumeric) {
    return <ExploreProfessorPage legacyId={parsed} professorRatings={professorRatings} />;
  }

  const professorName = decodeURIComponent(legacyId);
  if (!professorName) {
    return (
      <Box p={24} style={{ backgroundColor: "#141517", minHeight: "100vh" }}>
        <Text c="dimmed">{tr("explore.invalidProfessor")}</Text>
      </Box>
    );
  }

  return <ExploreProfessorPage professorName={professorName} professorRatings={professorRatings} />;
}
