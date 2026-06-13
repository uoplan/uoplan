import { createFileRoute } from "@tanstack/react-router";
import { ExploreProgramPage } from "../../../components/explore/ExploreProgramPage";
import { parseProgramPathParam } from "../../../lib/explore/programSearch";
import { useCatalogue } from "../../../store/hooks";

export const Route = createFileRoute("/explore/program/$")({
  component: ExploreProgramRoute,
});

function ExploreProgramRoute() {
  const { _splat } = Route.useParams();
  const slug = parseProgramPathParam(_splat) ?? "";

  const catalogue = useCatalogue();

  return <ExploreProgramPage programSlug={slug} catalogue={catalogue} />;
}
