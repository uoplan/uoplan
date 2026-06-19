import { IconBrandGooglePlay } from "@tabler/icons-react";
import { tr } from "../../i18n";
import { DismissibleHomeBanner } from "./DismissibleHomeBanner";
import { TopBanner } from "./TopBanner";

/** Where interested testers email to join the Android closed test. */
const TESTER_MAILTO = "mailto:admin@uoplan.party?subject=Android%20closed%20test";

/**
 * Temporary home-page nudge recruiting testers for the Android app's Play Store
 * closed test (production needs 12 testers for 14 days). Rendered once from the
 * root layout and self-gated to the home page via {@link DismissibleHomeBanner};
 * its CTA opens an email to admin@uoplan.party rather than an internal route.
 * Swapped in for the donation banner via `ACTIVE_HOME_BANNER` (see HomeBanner.tsx).
 */
export function TesterBanner() {
  return (
    <DismissibleHomeBanner>
      {(dismiss) => (
        <TopBanner
          href={TESTER_MAILTO}
          variant="success"
          icon={<IconBrandGooglePlay size={18} />}
          text={tr("landing.tester.text")}
          textShort={tr("landing.tester.textShort")}
          ctaLabel={tr("landing.tester.cta")}
          onDismiss={dismiss}
          dismissLabel={tr("landing.tester.dismiss")}
        />
      )}
    </DismissibleHomeBanner>
  );
}
