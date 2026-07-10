import { createFileRoute } from "@tanstack/react-router";
import { ExploreFacultyPage } from "../../../components/explore/ExploreFacultyPage";
import {
  useCatalogue,
  useDisciplines,
  useFaculties,
  useProfessorRatings,
} from "@uoplan/store/hooks";
import { buildFacultyHead } from "../../../lib/seo";

export const Route = createFileRoute("/explore/faculty/$faculty")({
  head: ({ params }) => buildFacultyHead(params.faculty),
  component: ExploreFacultyRoute,
});

function ExploreFacultyRoute() {
  const faculties = useFaculties();
  const disciplines = useDisciplines();
  const catalogue = useCatalogue();
  const professorRatings = useProfessorRatings();

  const { faculty } = Route.useParams();

  return (
    <ExploreFacultyPage
      facultyId={faculty}
      faculties={faculties}
      disciplines={disciplines}
      catalogue={catalogue}
      professorRatings={professorRatings}
    />
  );
}
