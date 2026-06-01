import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreProgramPage } from "../../../components/explore/ExploreProgramPage";
import { parseProgramPathParam } from "../../../lib/explore/programSearch";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/program/$")({
  component: ExploreProgramRoute,
});

function ExploreProgramRoute() {
  const { _splat } = Route.useParams();
  const slug = parseProgramPathParam(_splat) ?? "";

  const catalogue = useAppStore(useShallow((s) => s.catalogue));

  return <ExploreProgramPage programSlug={slug} catalogue={catalogue} />;
}
