import { DonationBanner } from "./DonationBanner";
import { TesterBanner } from "./TesterBanner";

/**
 * Which banner the home page shows. Flip back to `"donation"` to restore the
 * donation nudge once the Android closed test has enough testers (the
 * {@link TesterBanner} and its `landing.tester.*` strings can then be removed).
 */
const ACTIVE_HOME_BANNER: "donation" | "tester" = "tester";

/**
 * Single switch point for the home-page top banner. Renders exactly one of the
 * donation or tester-recruitment banners (each self-gates to `/` and is
 * dismissible), so they never stack. Mounted once in the root layout.
 */
export function HomeBanner() {
  return ACTIVE_HOME_BANNER === "tester" ? <TesterBanner /> : <DonationBanner />;
}
