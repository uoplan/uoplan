import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../components/landing/LandingPage";
import { buildPageHead } from "../lib/seo";

export const Route = createFileRoute("/")({
  head: () => buildPageHead("home"),
  component: LandingPage,
});
