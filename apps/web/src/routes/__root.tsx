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
import { useAppStore } from "../store/appStore";
import { useTr, tr } from "../i18n";
import { AppFooter } from "../components/shared/AppFooter";
import { SharedScheduleModal } from "../components/shared/SharedScheduleModal";
import { LazyCommandCenter } from "../components/shortcuts/LazyCommandCenter";
import { HotkeysHelpModal } from "../components/shortcuts/HotkeysHelpModal";
import { useGlobalHotkeys } from "../hooks/useGlobalHotkeys";

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
  const indices = useAppStore((s) => s.indices);
  const { pathname } = useLocation();
  const routerStatus = useRouterState({ select: (s) => s.status });
  const router = useRouter();
  const controls = useAnimation();
  const isCalendarRoute = pathname.startsWith("/schedule/calendar");
  const pendingAnimation = useRef(false);
  const lastNavAction = useRef<string>("PUSH");

  useGlobalHotkeys();

  useEffect(() => {
    return router.history.subscribe(({ action }) => {
      lastNavAction.current = action.type;
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
          minHeight: isCalendarRoute ? undefined : "100vh",
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
        <HotkeysHelpModal />
        <Box style={{ flex: 1, minHeight: 0 }}>
          <m.div animate={controls} style={isCalendarRoute ? { height: "100%" } : undefined}>
            <Outlet />
          </m.div>
        </Box>
        {!isCalendarRoute && <AppFooter />}
      </Box>
    </LazyMotion>
  );
}
