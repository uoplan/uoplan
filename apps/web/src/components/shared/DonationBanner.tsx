import { IconHeartFilled } from "@tabler/icons-react";
import { tr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { DismissibleHomeBanner } from "./DismissibleHomeBanner";
import { TopBanner } from "./TopBanner";

/**
 * Dismissible top-of-page nudge inviting support via /donate. Rendered once from
 * the root layout (so a dismissal sticks across navigation) and self-gated to
 * the home page via {@link DismissibleHomeBanner}.
 */
export function DonationBanner() {
  const analytics = useAnalytics();
  return (
    <DismissibleHomeBanner>
      {(dismiss) => (
        <TopBanner
          to="/donate"
          variant="accent"
          icon={<IconHeartFilled size={18} />}
          text={tr("landing.donate.text")}
          textShort={tr("landing.donate.textShort")}
          ctaLabel={tr("landing.donate.cta")}
          onClick={() => analytics.capture("donation_cta_clicked", { location: "home_banner" })}
          onDismiss={dismiss}
          dismissLabel={tr("landing.donate.dismiss")}
        />
      )}
    </DismissibleHomeBanner>
  );
}
