import { createFileRoute } from "@tanstack/react-router";
import { TrendsDisciplinesPage } from "../../components/trends/TrendsDisciplinesPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/trends/disciplines")({
  head: () => buildPageHead("trendsDisciplines"),
  component: TrendsDisciplinesPage,
});
