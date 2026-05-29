import { Link } from "@tanstack/react-router";
import { Anchor, Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { motion } from "framer-motion";
import { IconArrowRight, IconChevronLeft } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../explore/ExploreProfessorGradesLayout";
import { tr } from "../../i18n";

type ScheduleEditorStep = "program" | "completed" | "options" | "assign";

const STEP_ORDER: readonly ScheduleEditorStep[] = ["program", "completed", "options", "assign"];

type EditorHref = `/schedule/${"program" | "completed" | "options" | "requirements"}` | "/schedule";

function nextHrefFor(step: ScheduleEditorStep): EditorHref {
  const idx = STEP_ORDER.indexOf(step);
  const next = STEP_ORDER[idx + 1];
  if (!next) return "/schedule";
  return next === "assign" ? "/schedule/requirements" : `/schedule/${next}`;
}

type ScheduleEditorShellProps = {
  step: ScheduleEditorStep;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ScheduleEditorShell({ step, title, subtitle, children }: ScheduleEditorShellProps) {
  useLingui();
  const isLast = step === "assign";
  const nextHref = nextHrefFor(step);
  const ctaLabel = isLast ? tr("schedule.editor.done") : tr("schedule.editor.continue");

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
        pt={40}
        pb="lg"
        style={{
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
        }}
      >
        <Stack gap="md" maw={960} mx="auto" w="100%">
          <Anchor
            component={Link}
            to="/schedule"
            c="#A6A7AB"
            underline="hover"
            fz="sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              alignSelf: "flex-start",
            }}
          >
            <IconChevronLeft size={14} />
            {tr("schedule.editor.back")}
          </Anchor>
          <Stack gap={8}>
            <Title
              order={1}
              c="#F8F9FA"
              fw={500}
              fz={{ base: "h3", sm: "h2" }}
              lh={1.1}
              style={{ fontFamily: '"DM Serif Display", serif', textWrap: "balance" }}
            >
              {title}
            </Title>
            <Text size="sm" c="#ADB5BD" lh={1.55}>
              {subtitle}
            </Text>
          </Stack>
        </Stack>
      </Box>

      <Box
        style={{
          flex: 1,
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingTop: 24,
          paddingBottom: 80,
        }}
      >
        <Box maw={960} mx="auto" w="100%">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>

          <Group justify="flex-end" mt={48}>
            <Button
              component={Link}
              to={nextHref}
              color="constructBlack"
              radius={0}
              size="md"
              rightSection={<IconArrowRight size={16} />}
            >
              {ctaLabel}
            </Button>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
