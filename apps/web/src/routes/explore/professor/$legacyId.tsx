import { createFileRoute } from "@tanstack/react-router";
import { Box, Text } from "@mantine/core";
import { useShallow } from "zustand/react/shallow";
import { ExploreProfessorPage } from "../../../components/explore/ExploreProfessorPage";
import { tr } from "../../../i18n";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/professor/$legacyId")({
  component: ExploreProfessorRoute,
});

function ExploreProfessorRoute() {
  const { legacyId } = Route.useParams();
  const parsed = Number.parseInt(legacyId, 10);
  const isNumeric = Number.isFinite(parsed) && parsed > 0;

  const { catalogue, terms, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      terms: s.terms,
      professorRatings: s.professorRatings,
    })),
  );

  if (isNumeric) {
    return (
      <ExploreProfessorPage
        legacyId={parsed}
        catalogue={catalogue}
        terms={terms ?? []}
        professorRatings={professorRatings}
      />
    );
  }

  const professorName = decodeURIComponent(legacyId);
  if (!professorName) {
    return (
      <Box p={24} style={{ backgroundColor: "#141517", minHeight: "100vh" }}>
        <Text c="dimmed">{tr("explore.invalidProfessor")}</Text>
      </Box>
    );
  }

  return (
    <ExploreProfessorPage
      professorName={professorName}
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
    />
  );
}
