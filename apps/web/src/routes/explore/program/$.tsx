import { createFileRoute } from "@tanstack/react-router";
import { ExploreProgramPage } from "../../../components/explore/ExploreProgramPage";
import { parseProgramPathParam, programSlugToPathParam } from "../../../lib/explore/programSearch";
import { buildProgramHead } from "../../../lib/seo";
import { useCatalogue } from "@uoplan/store/hooks";

export const Route = createFileRoute("/explore/program/$")({
  head: ({ params }) => {
    const slug = parseProgramPathParam(params._splat) ?? "";
    return buildProgramHead({ slug, pathParam: programSlugToPathParam(slug) });
  },
  component: ExploreProgramRoute,
});

function ExploreProgramRoute() {
  const { _splat } = Route.useParams();
  const slug = parseProgramPathParam(_splat) ?? "";

  const catalogue = useCatalogue();

  return <ExploreProgramPage programSlug={slug} catalogue={catalogue} />;
}
