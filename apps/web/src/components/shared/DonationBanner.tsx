import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { IconHeartFilled } from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { TopBanner, TopBannerSlot } from "./TopBanner";

/**
 * Dismissible top-of-page nudge inviting support via /donate. Rendered once from
 * the root layout (so a dismissal sticks across navigation) and self-gated to
 * the home page. Shares the {@link TopBannerSlot} with the personalize banner so
 * both sit at the same height.
 */
export function DonationBanner() {
  useTr();
  const [dismissed, setDismissed] = useState(false);
  const onHome = useLocation({ select: (l) => l.pathname === "/" });

  if (dismissed || !onHome) return null;

  return (
    <TopBannerSlot>
      <TopBanner
        to="/donate"
        variant="accent"
        icon={<IconHeartFilled size={18} />}
        text={tr("landing.donate.text")}
        textShort={tr("landing.donate.textShort")}
        ctaLabel={tr("landing.donate.cta")}
        onDismiss={() => setDismissed(true)}
        dismissLabel={tr("landing.donate.dismiss")}
      />
    </TopBannerSlot>
  );
}
