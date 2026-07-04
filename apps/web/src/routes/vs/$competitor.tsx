import { createFileRoute, notFound } from "@tanstack/react-router";
import { VsComparison } from "../../components/comparison/VsComparison";
import { getCompetitorBySlug } from "../../lib/comparison";
import { buildVsHead } from "../../lib/seo";

export const Route = createFileRoute("/vs/$competitor")({
  beforeLoad: ({ params }) => {
    if (!getCompetitorBySlug(params.competitor)) throw notFound();
  },
  head: ({ params }) => buildVsHead(params.competitor),
  component: VsRoute,
});

function VsRoute() {
  const { competitor } = Route.useParams();
  const product = getCompetitorBySlug(competitor);
  if (!product) throw notFound();
  return <VsComparison competitor={product} />;
}
