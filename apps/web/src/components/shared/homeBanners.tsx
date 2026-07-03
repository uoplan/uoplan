import type { ReactNode } from "react";
import {
  IconBrandApple,
  IconBrandGithub,
  IconBrandGooglePlay,
  IconHeartFilled,
  IconMessageDots,
} from "@tabler/icons-react";
import type { TopBannerVariant } from "./TopBanner";

/** Where interested testers email to join the Android closed test. */
const ANDROID_TESTER_MAILTO = "mailto:admin@uoplan.party?subject=Android%20closed%20test";
/** Where feedback / feature requests are sent. */
const FEEDBACK_MAILTO = "mailto:admin@uoplan.party?subject=uoplan.party%20feedback";

/** A banner whose CTA is an internal route, vs. an external/`mailto:` URL. */
type HomeBannerLink = { to: "/donate"; href?: never } | { href: string; to?: never };

export type HomeBannerConfig = {
  /** Stable id; also used as the analytics `banner` property. */
  id: string;
  variant: TopBannerVariant;
  /** Leading icon, coloured to the variant's strong tone. */
  icon: ReactNode;
  /** Base of the i18n ids: `${idBase}.text`, `.textShort`, `.cta`. */
  idBase: string;
} & HomeBannerLink;

const ICON_SIZE = 18;

/**
 * The pool of nudges the home-page banner rotates through (see {@link HomeBanner}).
 * Each entry owns its icon, colour {@link TopBannerVariant}, link target, and the
 * base of its `landing.banner.*` translation ids. The order here is the rotation
 * order; the rotator starts on a random entry. When adding/removing a banner,
 * update the `landing.banner.<id>.*` strings in both PO files and the
 * `landing.banner.*` family in `scripts/i18n/dynamic-keys.ts`.
 */
export const HOME_BANNERS: readonly HomeBannerConfig[] = [
  {
    id: "donate",
    variant: "accent",
    icon: <IconHeartFilled size={ICON_SIZE} />,
    idBase: "landing.banner.donate",
    to: "/donate",
  },
  {
    id: "android",
    variant: "success",
    icon: <IconBrandGooglePlay size={ICON_SIZE} />,
    idBase: "landing.banner.android",
    href: ANDROID_TESTER_MAILTO,
  },
  {
    id: "ios",
    variant: "info",
    icon: <IconBrandApple size={ICON_SIZE} />,
    idBase: "landing.banner.ios",
    href: "https://apps.apple.com/app/id6784867164",
  },
  {
    id: "github",
    variant: "neutral",
    icon: <IconBrandGithub size={ICON_SIZE} />,
    idBase: "landing.banner.github",
    href: "https://github.com/uoplan/uoplan",
  },
  {
    id: "feedback",
    variant: "warning",
    icon: <IconMessageDots size={ICON_SIZE} />,
    idBase: "landing.banner.feedback",
    href: FEEDBACK_MAILTO,
  },
];
