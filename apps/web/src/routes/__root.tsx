import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  useLocation,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { buildRootHead } from "../lib/seo";
import { useEffect, useRef } from "react";
import { Box, Text } from "@mantine/core";
import { NavigationProgress, nprogress } from "@mantine/nprogress";
import { LazyMotion, m, useAnimation } from "framer-motion";
import { usePersistState } from "../hooks/usePersistState";
import { useIndices } from "../store/hooks";
import { tr, useTr } from "../i18n";
import { recordLocation } from "../lib/navigation/navigationHistory";
import { AppFooter } from "../components/shared/AppFooter";
import { SharedScheduleModal } from "../components/shared/SharedScheduleModal";
import { LazyCommandCenter } from "../components/shortcuts/LazyCommandCenter";
import { HotkeysHelpModal } from "../components/shortcuts/HotkeysHelpModal";
import { BasketFab } from "../components/basket/BasketFab";
import { HomeBanner } from "../components/shared/HomeBanner";
import { PersonalizeBanner } from "../components/shared/PersonalizeBanner";
import { useGlobalHotkeys } from "../hooks/useGlobalHotkeys";
import { useAnalytics } from "../lib/analytics";

// oxlint-disable-next-line promise/prefer-await-to-then -- dynamic-import mapping for LazyMotion; keeps the default-export usage traceable
const loadMotionFeatures = () => import("../lib/motionFeatures").then((mod) => mod.default);

export const Route = createRootRoute({
  head: () => buildRootHead(),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function NotFound() {
  useTr();

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        backgroundColor: "var(--app-bg)",
      }}
    >
      <Text c="dimmed" size="lg" fw={600}>
        Page not found
      </Text>
      <Text c="dimmed" size="sm" ta="center">
        This page does not exist.
      </Text>
      <Link to="/" style={{ color: "var(--mantine-color-accentBlue-4)" }}>
        {tr("app.nav.back")} — uoplan
      </Link>
    </Box>
  );
}

function RootLayout() {
  const indices = useIndices();
  const { pathname } = useLocation();
  const routerStatus = useRouterState({ select: (s) => s.status });
  const router = useRouter();
  const controls = useAnimation();
  const isCalendarRoute = pathname.startsWith("/schedule");
  // Explore renders its own cart (inline top-right on desktop, floating on mobile)
  // inside its layout, so it is excluded here. Personalize keeps a top-right cart;
  // trends (chrome controls) floats it bottom-right. The schedule calendar and
  // graph deliberately omit the floating cart — their plan controls live in the
  // page's own panels/sidebar, not a corner FAB.
  const showBasketFab =
    Boolean(indices) &&
    ["/personalize", "/trends", "/professor-graph"].some((prefix) => pathname.startsWith(prefix));
  const basketDesktopPlacement = pathname.startsWith("/personalize") ? "top-right" : "bottom-right";
  const pendingAnimation = useRef(false);
  const lastNavAction = useRef<string>("PUSH");
  const analytics = useAnalytics();
  const analyticsRef = useRef(analytics);

  useGlobalHotkeys();

  useEffect(() => {
    analyticsRef.current = analytics;
  }, [analytics]);

  useEffect(() => {
    const seed = router.history.location;
    recordLocation(seed.state.__TSR_index, seed.pathname, seed.search);
    analyticsRef.current.capturePageview({ path: seed.pathname });
    return router.history.subscribe(({ action, location }) => {
      lastNavAction.current = action.type;
      recordLocation(location.state.__TSR_index, location.pathname, location.search);
      analyticsRef.current.capturePageview({ path: location.pathname });
    });
  }, [router.history]);

  usePersistState(!!indices);

  useEffect(() => {
    const action = lastNavAction.current;
    if (action === "BACK" || action === "FORWARD" || action === "GO") {
      controls.set({ opacity: 1, y: 0 });
      pendingAnimation.current = false;
      return;
    }
    pendingAnimation.current = true;
    controls.set({ opacity: 0, y: 18 });
  }, [pathname, controls]);

  useEffect(() => {
    if (routerStatus === "idle" && pendingAnimation.current) {
      pendingAnimation.current = false;
      void controls.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      });
    }
  }, [routerStatus, controls]);

  useEffect(() => {
    if (routerStatus === "pending") {
      nprogress.start();
    } else if (routerStatus === "idle") {
      nprogress.complete();
    }
  }, [routerStatus]);

  useEffect(() => {
    return () => {
      nprogress.reset();
    };
  }, []);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <Box
        style={{
          minHeight: isCalendarRoute ? undefined : "100dvh",
          height: isCalendarRoute ? "100dvh" : undefined,
          overflow: isCalendarRoute ? "hidden" : undefined,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--app-bg)",
        }}
      >
        <NavigationProgress color="var(--app-focus-ring)" aria-label="Page loading progress" />
        <HeadContent />
        <SharedScheduleModal />
        <LazyCommandCenter />
        {showBasketFab && <BasketFab desktopPlacement={basketDesktopPlacement} />}
        <HotkeysHelpModal />
        <HomeBanner />
        <PersonalizeBanner />
        <Box style={isCalendarRoute ? { flex: 1, minHeight: 0 } : { minHeight: "100dvh" }}>
          <m.div animate={controls} style={isCalendarRoute ? { height: "100%" } : undefined}>
            <Outlet />
          </m.div>
        </Box>
        {!isCalendarRoute && <AppFooter />}
      </Box>
    </LazyMotion>
  );
}
