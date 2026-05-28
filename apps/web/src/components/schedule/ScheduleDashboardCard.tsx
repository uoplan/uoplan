import { useNavigate } from "@tanstack/react-router";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { IconAlertCircle, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import type { ScheduleDashboardCardStatus, ScheduleEditorHref } from "../../lib/scheduleDashboard";

const STATUS_ACCENT: Record<ScheduleDashboardCardStatus, string> = {
  ready: "#51cf66",
  attention: "#fab005",
  empty: "#5C5F66",
};

export type ScheduleDashboardCardProps = {
  label: string;
  status: ScheduleDashboardCardStatus;
  summary: string | ReactNode;
  to: ScheduleEditorHref;
  gateMessage?: string;
  gateTarget?: ScheduleEditorHref;
  expandableContent?: ReactNode;
};

function StatusIcon({
  status,
  locked,
  isExpandable,
  isOpen,
}: {
  status: ScheduleDashboardCardStatus;
  locked: boolean;
  isExpandable: boolean;
  isOpen: boolean;
}) {
  if (isExpandable) {
    return (
      <Box
        aria-hidden="true"
        style={{
          color: "#A6A7AB",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 180ms ease",
        }}
      >
        <IconChevronDown size={18} stroke={2} />
      </Box>
    );
  }
  if (locked) return null;
  if (status === "ready") {
    return (
      <Box
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: STATUS_ACCENT.ready,
          backgroundColor: `${STATUS_ACCENT.ready}22`,
          flexShrink: 0,
        }}
      >
        <IconCheck size={14} stroke={2.6} />
      </Box>
    );
  }
  if (status === "attention") {
    return (
      <Box
        aria-hidden="true"
        style={{
          color: STATUS_ACCENT.attention,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <IconAlertCircle size={20} stroke={2} />
      </Box>
    );
  }
  return null;
}

export function ScheduleDashboardCard({
  label,
  status,
  summary,
  to,
  gateMessage,
  gateTarget,
  expandableContent,
}: ScheduleDashboardCardProps) {
  useLingui();
  const navigate = useNavigate();
  const locked = Boolean(gateMessage);
  const accent = locked ? STATUS_ACCENT.empty : STATUS_ACCENT[status];
  const isExpandable = Boolean(expandableContent) && !locked;
  const [open, setOpen] = useState(false);
  const href = locked ? (gateTarget ?? to) : to;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isExpandable) {
      setOpen((v) => !v);
      return;
    }
    // Navigate on plain card click (not via <Link> so the entire card is hittable)
    event.preventDefault();
    void navigate({ to: href });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isExpandable) {
        setOpen((v) => !v);
      } else {
        void navigate({ to: href });
      }
    }
  };

  return (
    <Box
      style={{
        backgroundColor: "#1A1B1E",
        border: "1px solid #2C2E33",
        borderLeft: `2px solid ${accent}`,
        opacity: locked ? 0.58 : 1,
        transition: "border-color 180ms ease, background-color 180ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#1F2024";
        e.currentTarget.style.borderColor = "#3F424A";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#1A1B1E";
        e.currentTarget.style.borderColor = "#2C2E33";
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={isExpandable ? open : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        p="lg"
        style={{ cursor: "pointer", outline: "none" }}
      >
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Stack gap={6} style={{ textAlign: "left" }}>
            <Text size="xs" fw={700} tt="uppercase" c="#A6A7AB" style={{ letterSpacing: "0.08em" }}>
              {label}
            </Text>
            <Text size="md" c="#F8F9FA" fw={600} lh={1.25}>
              {summary}
            </Text>
            {gateMessage ? (
              <Text size="sm" c="#ADB5BD">
                {gateMessage}
              </Text>
            ) : null}
          </Stack>
          <StatusIcon status={status} locked={locked} isExpandable={isExpandable} isOpen={open} />
        </Group>
      </Box>

      <AnimatePresence initial={false}>
        {isExpandable && open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <Box style={{ borderTop: "1px solid #2C2E33" }}>{expandableContent}</Box>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Box>
  );
}
