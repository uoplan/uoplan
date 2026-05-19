import { createFileRoute } from "@tanstack/react-router";
import { Box, Text } from "@mantine/core";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../../components/explore/ExploreLayout";
import { ExploreProfessorPage } from "../../../components/explore/ExploreProfessorPage";
import { tr } from "../../../i18n";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/professor/$legacyId")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
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

  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  const layoutProps = {
    showBackButton: true as const,
    catalogue,
    terms: terms ?? [],
    professorRatings,
    initialQuery: q ?? "",
    onQueryChange: (v: string) =>
      void navigate({
        search: { q: v.length > 0 ? v : undefined },
        replace: true,
      }),
  };

  if (isNumeric) {
    return (
      <ExploreLayout {...layoutProps}>
        <ExploreProfessorPage
          legacyId={parsed}
          catalogue={catalogue}
          terms={terms ?? []}
          professorRatings={professorRatings}
        />
      </ExploreLayout>
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
    <ExploreLayout {...layoutProps}>
      <ExploreProfessorPage
        professorName={professorName}
        catalogue={catalogue}
        terms={terms ?? []}
        professorRatings={professorRatings}
      />
    </ExploreLayout>
  );
}
