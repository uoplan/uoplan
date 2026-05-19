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
import { useLingui } from "@lingui/react";
import { Box, Text } from "@mantine/core";
import { motion, useAnimation } from "framer-motion";
import { usePersistState } from "../hooks/usePersistState";
import { useAppStore } from "../store/appStore";
import { tr } from "../i18n";
import { AppFooter } from "../components/shared/AppFooter";

export const Route = createRootRoute({
  head: () => buildRootHead(),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function NotFound() {
  useLingui();

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
        backgroundColor: "#141517",
      }}
    >
      <Text c="dimmed" size="lg" fw={600}>
        Page not found
      </Text>
      <Text c="dimmed" size="sm" ta="center">
        This page does not exist.
      </Text>
      <Link to="/" style={{ color: "var(--mantine-color-violet-4)" }}>
        {tr("app.nav.back")} — uoplan
      </Link>
    </Box>
  );
}

function RootLayout() {
  const loadData = useAppStore((s) => s.loadData);
  const indices = useAppStore((s) => s.indices);
  const { pathname } = useLocation();
  const routerStatus = useRouterState({ select: (s) => s.status });
  const router = useRouter();
  const controls = useAnimation();
  const pendingAnimation = useRef(false);
  const lastNavAction = useRef<string>("PUSH");

  useEffect(() => {
    return router.history.subscribe(({ action }) => {
      lastNavAction.current = action.type;
    });
  }, [router.history]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#141517",
      }}
    >
      <HeadContent />
      <Box style={{ flex: 1 }}>
        <motion.div animate={controls}>
          <Outlet />
        </motion.div>
      </Box>
      <AppFooter />
    </Box>
  );
}
