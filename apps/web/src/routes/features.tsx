import { createFileRoute } from "@tanstack/react-router";
import { FeatureShowcase } from "../components/comparison/FeatureShowcase";
import { buildFeaturesHead } from "../lib/seo";

export const Route = createFileRoute("/features")({
  head: () => buildFeaturesHead(),
  component: FeatureShowcase,
});
