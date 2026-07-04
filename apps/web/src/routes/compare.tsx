import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "../components/comparison/ComparisonPage";
import { buildCompareHead } from "../lib/seo";

export const Route = createFileRoute("/compare")({
  head: () => buildCompareHead(),
  component: ComparisonPage,
});
