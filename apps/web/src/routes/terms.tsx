import { createFileRoute } from "@tanstack/react-router";
import { i18n, normalizeLocale, useTr } from "../i18n";
import { buildPageHead } from "../lib/seo";
import { TERMS_BY_LOCALE } from "../lib/legalContent";
import { LegalDocView } from "../components/shared/LegalDocView";

export const Route = createFileRoute("/terms")({
  head: () => buildPageHead("terms"),
  component: TermsRoute,
});

function TermsRoute() {
  useTr();
  const doc = TERMS_BY_LOCALE[normalizeLocale(i18n.locale)];
  return <LegalDocView doc={doc} />;
}
