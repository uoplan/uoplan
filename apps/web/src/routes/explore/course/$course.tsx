import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../../components/explore/ExploreLayout";
import { ExploreCoursePage } from "../../../components/explore/ExploreCoursePage";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/course/$course")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const { catalogue, terms, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      terms: s.terms,
      professorRatings: s.professorRatings,
    })),
  );

  const { course } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ExploreLayout
      showBackButton
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      initialQuery={q ?? ""}
      onQueryChange={(v) =>
        void navigate({
          search: { q: v.length > 0 ? v : undefined },
          replace: true,
        })
      }
    >
      <ExploreCoursePage
        urlCourseParam={course}
        catalogue={catalogue}
        terms={terms ?? []}
        professorRatings={professorRatings}
      />
    </ExploreLayout>
  );
}
