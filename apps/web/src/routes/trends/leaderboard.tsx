import { createFileRoute } from "@tanstack/react-router";
import { TrendsLeaderboardPage } from "../../components/trends/TrendsLeaderboardPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/trends/leaderboard")({
  head: () => buildPageHead("trendsLeaderboard"),
  component: TrendsLeaderboardPage,
});
