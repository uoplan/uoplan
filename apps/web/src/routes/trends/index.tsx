import { createFileRoute } from "@tanstack/react-router";
import { TrendsHubPage } from "../../components/trends/TrendsHubPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/trends/")({
  head: () => buildPageHead("trends"),
  component: TrendsHubPage,
});
