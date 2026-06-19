import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useTr } from "../../i18n";
import { TopBannerSlot } from "./TopBanner";

/**
 * Shared shell for the home-page top banners (donation / tester recruitment).
 * Owns the behaviour they have in common: it re-renders on locale change
 * (`useTr`), is dismissible, self-gates to the home page, and wraps its content
 * in the shared {@link TopBannerSlot} so every banner lines up at the same
 * height. Each concrete banner supplies its {@link TopBanner} via a render prop
 * that receives the dismiss handler.
 */
export function DismissibleHomeBanner({
  children,
}: {
  children: (dismiss: () => void) => ReactNode;
}) {
  useTr();
  const [dismissed, setDismissed] = useState(false);
  const onHome = useLocation({ select: (l) => l.pathname === "/" });

  if (dismissed || !onHome) return null;

  return <TopBannerSlot>{children(() => setDismissed(true))}</TopBannerSlot>;
}
