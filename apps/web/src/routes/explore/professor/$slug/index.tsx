import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ExploreProfessorPage } from "../../../../components/explore/ExploreProfessorPage";
import { resolveProfessorRoute } from "../../../../lib/explore/professorRoute";
import { buildProfessorDocumentTitle, buildProfessorHead } from "../../../../lib/seo";
import { useProfessorRegistry } from "../../../../store/hooks";

export const Route = createFileRoute("/explore/professor/$slug/")({
  head: ({ params }) => buildProfessorHead(params.slug),
  component: ExploreProfessorRoute,
});

function ExploreProfessorRoute() {
  const { slug } = Route.useParams();
  const registry = useProfessorRegistry();

  useEffect(() => {
    const resolved = resolveProfessorRoute(registry, slug);
    if (resolved.displayName) document.title = buildProfessorDocumentTitle(resolved.displayName);
  }, [registry, slug]);

  return <ExploreProfessorPage slug={slug} />;
}
