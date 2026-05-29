import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { motion } from "framer-motion";
import { IconRefresh } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../explore/ExploreProfessorGradesLayout";
import { ResetModal } from "../shared/ResetModal";
import { useAppStore, useAppStoreApi } from "../../store/appStore";
import { tr } from "../../i18n";
import { getGenerateBlockers, getScheduleDashboardCards } from "../../lib/scheduleDashboard";
import { ScheduleDashboardCard } from "./ScheduleDashboardCard";
import { GenerateConfirmationModal } from "./GenerateConfirmationModal";
import { TermPicker } from "./TermPicker";
import { NotificationToggle } from "../steps/NotificationToggle";

export function ScheduleDashboardPage() {
  useLingui();
  const navigate = useNavigate();
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dashboardState = useAppStore(
    useShallow((s) => ({
      terms: s.terms,
      selectedTermId: s.selectedTermId,
      cacheLoaded: Boolean(s.cache),
      firstYear: s.firstYear,
      program: s.program,
      completedCourses: s.completedCourses,
      requirementTreeWithStatus: s.requirementTreeWithStatus,
      selectedOptionsPerRequirement: s.selectedOptionsPerRequirement,
      unassignedCompletedCourses: s.unassignedCompletedCourses,
    })),
  );
  const resetToDefault = useAppStore((s) => s.resetToDefault);
  const scheduleGenerating = useAppStore((s) => s.scheduleGenerating);
  const setSelectedTermId = useAppStore((s) => s.setSelectedTermId);
  const storeApi = useAppStoreApi();

  const cards = useMemo(() => getScheduleDashboardCards(dashboardState), [dashboardState]);
  const blockers = useMemo(() => getGenerateBlockers(dashboardState), [dashboardState]);
  const readyCount = cards.filter((card) => card.status === "ready" && !card.gateMessage).length;
  const readiness =
    blockers.length === 0
      ? tr("schedule.dashboard.ready")
      : tr("schedule.dashboard.readyCount", { ready: readyCount, total: cards.length });

  const generateAndNavigate = () => {
    setConfirmOpen(false);
    void storeApi
      .getState()
      .generateSchedules()
      .then(() => navigate({ to: "/schedule/calendar" }));
  };

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        backgroundColor: "#141517",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <Box
        pt={32}
        pb="xl"
        style={{
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
        }}
      >
        <Stack gap="xs" maw={760} mx="auto" w="100%">
          <Title
            order={1}
            c="#F8F9FA"
            fw={500}
            fz={{ base: "h2", sm: 44 }}
            lh={1.05}
            style={{ fontFamily: '"DM Serif Display", serif', textWrap: "balance" }}
          >
            {tr("schedule.dashboard.title")}
          </Title>
          <Text size="sm" c="#ADB5BD">
            {readiness}
          </Text>
        </Stack>
      </Box>

      <Box
        style={{
          flex: 1,
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingBottom: 48,
        }}
      >
        <Stack gap="md" maw={760} mx="auto" w="100%">
          <Box
            p="md"
            style={{
              backgroundColor: "#1A1B1E",
              border: "1px solid #2C2E33",
            }}
          >
            <NotificationToggle />
          </Box>

          {cards.map((card, index) => {
            const expandableContent =
              card.id === "term" ? (
                dashboardState.terms ? (
                  <TermPicker
                    terms={dashboardState.terms}
                    value={dashboardState.selectedTermId}
                    onChange={(termId) => {
                      void setSelectedTermId(termId);
                    }}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    Loading terms…
                  </Text>
                )
              ) : undefined;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: index * 0.035 }}
              >
                <ScheduleDashboardCard {...card} expandableContent={expandableContent} />
              </motion.div>
            );
          })}

          <Group justify="space-between" mt="lg" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              radius={0}
              leftSection={<IconRefresh size={16} />}
              onClick={() => setResetModalOpen(true)}
            >
              {tr("app.reset.action")}
            </Button>
            <Button
              color="constructBlack"
              radius={0}
              loading={scheduleGenerating}
              onClick={() => {
                if (blockers.length > 0) {
                  setConfirmOpen(true);
                  return;
                }
                generateAndNavigate();
              }}
            >
              {tr("schedule.dashboard.generate")}
            </Button>
          </Group>
        </Stack>
      </Box>

      <ResetModal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={() => {
          resetToDefault();
          setResetModalOpen(false);
        }}
      />
      <GenerateConfirmationModal
        opened={confirmOpen}
        blockers={blockers}
        onCancel={() => setConfirmOpen(false)}
        onGenerateAnyway={generateAndNavigate}
      />
    </Box>
  );
}
