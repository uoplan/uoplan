import { createFileRoute } from "@tanstack/react-router";
import { TrendsFeedbackPage } from "../../components/trends/TrendsFeedbackPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/trends/feedback")({
  head: () => buildPageHead("trendsFeedback"),
  component: TrendsFeedbackPage,
});
