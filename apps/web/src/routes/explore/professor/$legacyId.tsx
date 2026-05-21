import { createFileRoute } from "@tanstack/react-router";
import { Box, Text } from "@mantine/core";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../../components/explore/ExploreLayout";
import { ExploreProfessorPage } from "../../../components/explore/ExploreProfessorPage";
import { tr } from "../../../i18n";
import { useAppStore } from "../../../store/appStore";
import {
  validateExploreSearch,
  type ExploreSearchParams,
} from "../../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore/professor/$legacyId")({
  validateSearch: validateExploreSearch,
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

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const layoutProps = {
    showBackButton: true as const,
    catalogue,
    terms: terms ?? [],
    professorRatings,
    searchParams: search,
    onQueryChange: (_: string, nextSearch: ExploreSearchParams) =>
      void navigate({
        search: nextSearch,
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
