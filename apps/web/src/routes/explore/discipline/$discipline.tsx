import { createFileRoute } from "@tanstack/react-router";
import { ExploreDisciplinePage } from "../../../components/explore/ExploreDisciplinePage";
import {
  useCatalogue,
  useDisciplines,
  useFaculties,
  useProfessorRatings,
} from "../../../store/hooks";

export const Route = createFileRoute("/explore/discipline/$discipline")({
  head: ({ params }) => ({ meta: [{ title: params.discipline.toUpperCase() }] }),
  component: ExploreDisciplineRoute,
});

function ExploreDisciplineRoute() {
  const professorRatings = useProfessorRatings();
  const disciplines = useDisciplines();
  const faculties = useFaculties();
  const catalogue = useCatalogue();

  const { discipline } = Route.useParams();

  return (
    <ExploreDisciplinePage
      disciplineCode={discipline}
      disciplines={disciplines}
      faculties={faculties}
      catalogue={catalogue}
      professorRatings={professorRatings}
    />
  );
}
