import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ExploreProfessorPage } from "../../../../components/explore/ExploreProfessorPage";
import { resolveProfessorRoute } from "../../../../lib/explore/professorRoute";
import { useProfessorRegistry } from "../../../../store/hooks";

export const Route = createFileRoute("/explore/professor/$slug/")({
  head: ({ params }) => {
    const id = Number.parseInt(params.slug, 10);
    const isNumeric = Number.isFinite(id) && id > 0;
    const title = isNumeric ? "Professor" : decodeURIComponent(params.slug);
    return { meta: [{ title }] };
  },
  component: ExploreProfessorRoute,
});

function ExploreProfessorRoute() {
  const { slug } = Route.useParams();
  const registry = useProfessorRegistry();

  useEffect(() => {
    const resolved = resolveProfessorRoute(registry, slug);
    if (resolved.displayName) document.title = resolved.displayName;
  }, [registry, slug]);

  return <ExploreProfessorPage slug={slug} />;
}
