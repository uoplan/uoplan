import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { tr, useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import classes from "./HomeBanner.module.css";
import { HOME_BANNERS } from "./homeBanners";
import type { HomeBannerConfig } from "./homeBanners";
import { TopBanner, TopBannerSlot } from "./TopBanner";

/** How long each banner is shown before sliding to the next. */
const ROTATE_MS = 7000;

/**
 * The home-page top banner: a rotating stack of nudges (donation, app betas,
 * GitHub star, feedback — see {@link HOME_BANNERS}). Each slide shifts out
 * vertically as the next shifts in, starting on a random banner. Mounted once in
 * the root layout (so a dismissal sticks across navigation) and self-gated to the
 * home page; dismissing hides the whole rotator for the session.
 *
 * Rotation pauses while the banner is hovered or focused (so it can be read and
 * clicked). Honours `prefers-reduced-motion` by showing a single static random
 * banner with no animation or auto-rotation.
 */
export function HomeBanner() {
  useTr();
  const analytics = useAnalytics();
  const prefersReduced = useReducedMotion();
  const onHome = useLocation({ select: (l) => l.pathname === "/" });

  // Lazy initial state so the starting banner is random but stable across renders.
  const [index, setIndex] = useState(() => Math.floor(Math.random() * HOME_BANNERS.length));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const paused = hovered || focused;

  useEffect(() => {
    if (prefersReduced || paused || dismissed || !onHome) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % HOME_BANNERS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [prefersReduced, paused, dismissed, onHome]);

  if (dismissed || !onHome) return null;

  const active = HOME_BANNERS[index];

  const handleCta = (banner: HomeBannerConfig) => {
    analytics.capture("home_banner_cta_clicked", { banner: banner.id });
    // Keep the existing donation funnel populated from the rotating banner too.
    if (banner.id === "donate") {
      analytics.capture("donation_cta_clicked", { location: "home_banner" });
    }
  };

  const handleDismiss = () => {
    analytics.capture("home_banner_dismissed", { banner: active.id });
    setDismissed(true);
  };

  const renderBanner = (banner: HomeBannerConfig) => {
    const common = {
      variant: banner.variant,
      icon: banner.icon,
      text: tr(`${banner.idBase}.text`),
      textShort: tr(`${banner.idBase}.textShort`),
      ctaLabel: tr(`${banner.idBase}.cta`),
      onClick: () => handleCta(banner),
      onDismiss: handleDismiss,
      dismissLabel: tr("landing.banner.dismiss"),
    };
    return banner.to ? (
      <TopBanner to={banner.to} {...common} />
    ) : (
      <TopBanner href={banner.href} {...common} />
    );
  };

  if (prefersReduced) {
    return <TopBannerSlot>{renderBanner(active)}</TopBannerSlot>;
  }

  return (
    <TopBannerSlot>
      <div
        className={classes.viewport}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div aria-hidden className={classes.reserve}>
          {renderBanner(active)}
        </div>
        <AnimatePresence initial={false}>
          <m.div
            key={active.id}
            className={classes.slide}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-110%", opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {renderBanner(active)}
          </m.div>
        </AnimatePresence>
      </div>
    </TopBannerSlot>
  );
}
