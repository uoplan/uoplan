import { createFileRoute } from "@tanstack/react-router";
import { i18n, normalizeLocale, useTr } from "../i18n";
import { buildPageHead } from "../lib/seo";
import { PRIVACY_BY_LOCALE } from "../lib/legalContent";
import { LegalDocView } from "../components/shared/LegalDocView";

export const Route = createFileRoute("/privacy")({
  head: () => buildPageHead("privacy"),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  useTr();
  const doc = PRIVACY_BY_LOCALE[normalizeLocale(i18n.locale)];
  return <LegalDocView doc={doc} />;
}
