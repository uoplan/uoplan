import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { motion } from "framer-motion";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../explore/ExploreProfessorGradesLayout";
import { ResetModal } from "../shared/ResetModal";
import { useAppStore, useAppStoreApi } from "../../store/appStore";
import { tr } from "../../i18n";
import {
  getGenerateBlockers,
  getScheduleDashboardCards,
  resolveInitialOpenStep,
  type ScheduleStepId,
} from "../../lib/scheduleDashboard";
import { ScheduleDashboardCard } from "./ScheduleDashboardCard";
import { GenerateConfirmationModal } from "./GenerateConfirmationModal";
import { TermPicker } from "./TermPicker";
import { ProgramCoursesPanel } from "./ProgramCoursesPanel";
import { OptionsPanel } from "./OptionsPanel";
import { AssignPanel } from "./AssignPanel";
import { NotificationToggle } from "../steps/NotificationToggle";
import { BackButton } from "../shared/BackButton";
import "./scheduleDashboard.css";

export function ScheduleDashboardPage() {
  useLingui();
  const navigate = useNavigate();
  const search = useSearch({ from: "/schedule/" });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openStep, setOpenStep] = useState<ScheduleStepId | null>(() => search.step ?? null);
  const didInit = useRef(false);

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

  // Auto-open the first step that needs attention — only once on mount, so that
  // selecting a term/program doesn't yank the open section away from the user.
  // An explicit ?step deep link always takes precedence.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setOpenStep((current) => current ?? resolveInitialOpenStep(cards, search.step));
  }, [cards, search.step]);

  // Respond to external ?step changes (e.g. the calendar "upload transcript" button).
  useEffect(() => {
    if (search.step) setOpenStep(search.step);
  }, [search.step]);

  const toggleStep = (id: ScheduleStepId) => {
    const next = openStep === id ? null : id;
    setOpenStep(next);
    void navigate({
      to: "/schedule",
      search: { step: next ?? undefined },
      replace: true,
    });
  };

  const generateAndNavigate = () => {
    setConfirmOpen(false);
    void storeApi
      .getState()
      .generateSchedules()
      .then(() =>
        navigate({
          to: "/schedule/calendar",
          state: { back: { to: "/schedule", label: tr("landing.schedule.title") } } as never,
        }),
      );
  };

  const contentForStep = (id: ScheduleStepId) => {
    switch (id) {
      case "term":
        return dashboardState.terms ? (
          <TermPicker
            terms={dashboardState.terms}
            value={dashboardState.selectedTermId}
            onChange={(termId) => {
              void setSelectedTermId(termId);
            }}
          />
        ) : (
          <Text size="sm" c="dimmed" p="lg">
            {tr("schedule.dashboard.term.loading")}
          </Text>
        );
      case "program":
        return <ProgramCoursesPanel />;
      case "options":
        return <OptionsPanel />;
      case "assign":
        return <AssignPanel />;
      default:
        return undefined;
    }
  };

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--app-bg)",
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
          <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />
          <Title
            order={1}
            c="var(--app-text)"
            fw={500}
            fz={{ base: "h2", sm: 44 }}
            lh={1.05}
            style={{ fontFamily: '"DM Serif Display", serif', textWrap: "balance" }}
          >
            {tr("schedule.dashboard.title")}
          </Title>
          <Text size="sm" c="var(--app-text-muted)">
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
            px="sm"
            py={8}
            style={{
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <NotificationToggle />
          </Box>

          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: index * 0.035 }}
            >
              <ScheduleDashboardCard
                label={card.label}
                status={card.status}
                summary={card.summary}
                gateMessage={card.gateMessage}
                open={openStep === card.id}
                onToggle={() => toggleStep(card.id)}
                expandableContent={contentForStep(card.id)}
              />
            </motion.div>
          ))}

          <Group justify="space-between" mt="lg" gap="sm">
            <Button
              variant="default"
              radius={0}
              leftSection={<IconRefresh size={16} />}
              onClick={() => setResetModalOpen(true)}
              styles={{
                root: { color: "var(--app-text-muted)" },
              }}
            >
              {tr("app.reset.action")}
            </Button>
            <Button
              radius={0}
              loading={scheduleGenerating}
              className={
                blockers.length === 0 && !scheduleGenerating ? "generate-cta--ready" : undefined
              }
              leftSection={<IconSparkles size={16} />}
              styles={{
                root: {
                  backgroundColor: "var(--app-accent)",
                  color: "var(--app-on-accent)",
                  paddingInline: "1.5rem",
                },
              }}
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
