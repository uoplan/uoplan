import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreDisciplinePage } from "../../../components/explore/ExploreDisciplinePage";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/discipline/$discipline")({
  head: ({ params }) => ({ meta: [{ title: params.discipline.toUpperCase() }] }),
  component: ExploreDisciplineRoute,
});

function ExploreDisciplineRoute() {
  const { professorRatings, disciplines } = useAppStore(
    useShallow((s) => ({
      professorRatings: s.professorRatings,
      disciplines: s.disciplines,
    })),
  );

  const { discipline } = Route.useParams();

  return (
    <ExploreDisciplinePage
      disciplineCode={discipline}
      disciplines={disciplines}
      professorRatings={professorRatings}
    />
  );
}
