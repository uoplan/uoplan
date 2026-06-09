import { Alert, Badge, Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { tr, useTr } from "../../i18n";
import { toUrlSearch } from "../../lib/trends/searchParams";
import { BackButton } from "../shared/BackButton";
import { ChromeControls } from "../shared/ChromeControls";
import { CalendarMobileDrawer } from "../calendar/CalendarMobileDrawer";
import { useTrends } from "./trendsContext";
import { TrendsFilterControls } from "./TrendsFilterControls";
import { TrendsFilterBarSkeleton, TrendsHubSkeleton } from "./TrendsSkeletons";

/**
 * Persistent shell for every `/trends` route: page header, the shared sticky
 * filter bar (mobile: a floating button + drawer), and the active sub-page via
 * `<Outlet/>`. Top-level error / empty states are handled here so each sub-page
 * can assume data is present.
 */
export function TrendsLayout() {
  useTr();
  const { isMobile, ready, gradesError, scopeSummary, metricLabel, activeFilterCount, search } =
    useTrends();

  const [filtersOpen, setFiltersOpen] = useState(false);

  // The layout is shared across the hub and its sub-pages; on a sub-page the
  // back affordance should return to the trends hub (carrying current filters)
  // rather than all the way to the home page.
  const onSubPage = useLocation({
    select: (s) => s.pathname.replace(/\/+$/, "") !== "/trends",
  });

  return (
    <Box
      component="main"
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: isMobile ? 16 : 24,
        paddingBottom: isMobile ? "calc(88px + env(safe-area-inset-bottom))" : 24,
        backgroundColor: "var(--app-bg)",
        boxSizing: "border-box",
        overflowX: "clip",
      }}
    >
      <Stack gap="lg" w="100%" maw={1000} mx="auto">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={4}>
            {onSubPage ? (
              <BackButton
                fallbackTo="/trends"
                fallbackLabel={tr("app.nav.backTrends")}
                fallbackSearch={toUrlSearch(search)}
              />
            ) : (
              <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />
            )}
            <Title
              order={1}
              style={{
                fontFamily: "var(--app-font-heading)",
                color: "var(--app-text)",
                fontWeight: 400,
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
              }}
            >
              {tr("trends.title")}
            </Title>
            <Text size="sm" c="dimmed" maw={620}>
              {tr("trends.subtitle")}
            </Text>
          </Stack>
          <ChromeControls />
        </Group>

        {gradesError ? (
          <Alert color="red" title={tr("trends.error.title")}>
            {gradesError}
          </Alert>
        ) : !ready ? (
          <>
            {!isMobile ? (
              <Box
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  width: "100vw",
                  marginInline: "calc(50% - 50vw)",
                  backgroundColor: "color-mix(in srgb, var(--app-surface-sunken) 78%, transparent)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  borderBottom: "var(--app-border-width) solid var(--app-border)",
                  padding: "20px 24px",
                  boxSizing: "border-box",
                }}
              >
                <Box w="100%" maw={1000} mx="auto">
                  <TrendsFilterBarSkeleton />
                </Box>
              </Box>
            ) : null}
            <TrendsHubSkeleton isMobile={isMobile} />
          </>
        ) : (
          <>
            {!isMobile ? (
              <Box
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  width: "100vw",
                  marginInline: "calc(50% - 50vw)",
                  backgroundColor: "color-mix(in srgb, var(--app-surface-sunken) 78%, transparent)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  borderBottom: "var(--app-border-width) solid var(--app-border)",
                  padding: "20px 24px",
                  boxSizing: "border-box",
                }}
              >
                <Box w="100%" maw={1000} mx="auto">
                  <TrendsFilterControls />
                </Box>
              </Box>
            ) : null}

            <Outlet />

            {isMobile ? (
              <>
                <Box
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 150,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
                    backgroundColor: "var(--app-surface)",
                    borderTop: "var(--app-border-width) solid var(--app-border)",
                  }}
                >
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" c="dimmed">
                      {metricLabel}
                    </Text>
                    <Text size="sm" fw={600} truncate c="var(--app-text)">
                      {scopeSummary}
                    </Text>
                  </Stack>
                  <Button
                    variant="light"
                    leftSection={<IconAdjustmentsHorizontal size={16} stroke={1.6} />}
                    onClick={() => setFiltersOpen(true)}
                    rightSection={
                      activeFilterCount > 0 ? (
                        <Badge size="sm" circle variant="filled">
                          {activeFilterCount}
                        </Badge>
                      ) : undefined
                    }
                  >
                    {tr("trends.filter.mobileButton")}
                  </Button>
                </Box>

                <CalendarMobileDrawer
                  opened={filtersOpen}
                  onClose={() => setFiltersOpen(false)}
                  title={tr("trends.filter.mobileTitle")}
                  ariaLabel={tr("trends.filter.mobileTitle")}
                >
                  <TrendsFilterControls />
                </CalendarMobileDrawer>
              </>
            ) : null}
          </>
        )}
      </Stack>
    </Box>
  );
}
