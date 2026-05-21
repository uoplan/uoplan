import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../../components/explore/ExploreLayout";
import { ExploreCoursePage } from "../../../components/explore/ExploreCoursePage";
import { useAppStore } from "../../../store/appStore";
import { validateExploreSearch } from "../../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore/course/$course")({
  validateSearch: validateExploreSearch,
  head: ({ params }) => ({ meta: [{ title: params.course.toUpperCase() }] }),
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ExploreLayout
      showBackButton
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      searchParams={search}
      onQueryChange={(_, nextSearch) =>
        void navigate({
          search: nextSearch,
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
