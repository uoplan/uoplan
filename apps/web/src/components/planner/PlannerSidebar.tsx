import { lazy, Suspense } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconLayoutGrid,
  IconSchool,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { BackButton } from "../shared/BackButton";
import styles from "./planner.module.css";

// The advanced generation options pull in the full requirement-assignment UI;
// load it only when the sidebar renders it (program selected).
const AdvancedGenerationOptions = lazy(async () => {
  const m = await import("../calendar/AdvancedGenerationOptions");
  return { default: m.AdvancedGenerationOptions };
});

export interface PlannerSidebarProps {
  hasProgram: boolean;
  hasTranscript: boolean;
  isGenerating: boolean;
  hasEnabledTerms: boolean;
  defaultCount: number;
  onDefaultCountChange: (count: number) => void;
  onRegenerateAll: () => void;
  onClearPlan: () => void;
  onResetLayout: () => void;
  onPersonalize: () => void;
  /**
   * Render the reset-layout / clear-plan icon buttons in the body. The desktop
   * floating panel puts them in its draggable header instead, so it passes
   * `false`; the mobile drawer keeps them here.
   */
  showLayoutActions?: boolean;
}

function LegendItem({ token, label }: { token: string; label: string }) {
  return (
    <div className={styles.legendRow}>
      <span className={styles.legendDot} style={{ background: `var(${token})` }} />
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
    </div>
  );
}

export function PlannerSidebar(props: PlannerSidebarProps) {
  useTr();
  const {
    hasProgram,
    hasTranscript,
    isGenerating,
    hasEnabledTerms,
    defaultCount,
    onDefaultCountChange,
    onRegenerateAll,
    onClearPlan,
    onResetLayout,
    onPersonalize,
    showLayoutActions = true,
  } = props;

  return (
    <Stack gap="md">
      <BackButton fallbackTo="/personalize" />

      {!hasProgram ? (
        <Alert
          variant="light"
          color="blue"
          icon={<IconInfoCircle size={16} />}
          title={tr("planner.needProgram.title")}
        >
          <Stack gap="xs">
            <Text fz="sm">{tr("planner.needProgram.body")}</Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconSchool size={14} />}
              onClick={onPersonalize}
            >
              {tr("planner.needProgram.cta")}
            </Button>
          </Stack>
        </Alert>
      ) : null}

      {hasProgram && !hasTranscript ? (
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />}>
          {tr("planner.uploadHint")}
        </Alert>
      ) : null}

      <Button
        size="md"
        leftSection={<IconSparkles size={16} />}
        loading={isGenerating}
        disabled={!hasProgram || !hasEnabledTerms}
        onClick={onRegenerateAll}
      >
        {tr("planner.generate")}
      </Button>

      <Group gap="xs" align="flex-end" grow>
        <NumberInput
          size="xs"
          label={tr("planner.defaultCount.label")}
          description={tr("planner.defaultCount.description")}
          min={1}
          max={12}
          value={defaultCount}
          disabled={isGenerating}
          onChange={(v) =>
            onDefaultCountChange(typeof v === "number" ? v : Number(v) || defaultCount)
          }
        />
      </Group>

      {showLayoutActions ? (
        <Group gap="xs">
          <Tooltip label={tr("planner.controls.resetLayout")} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={tr("planner.controls.resetLayout")}
              onClick={onResetLayout}
            >
              <IconLayoutGrid size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr("planner.clearPlan")} withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              aria-label={tr("planner.clearPlan")}
              disabled={isGenerating || !hasEnabledTerms}
              onClick={onClearPlan}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}

      {hasProgram ? (
        <>
          <Divider label={tr("planner.options.title")} labelPosition="left" />
          <Suspense fallback={<Skeleton height={220} radius="md" />}>
            <AdvancedGenerationOptions />
          </Suspense>
        </>
      ) : null}

      <Divider label={tr("planner.legend.title")} labelPosition="left" />
      <Stack gap={6}>
        <LegendItem token="--app-success" label={tr("planner.legend.completed")} />
        <LegendItem token="--app-accent" label={tr("planner.legend.planned")} />
        <LegendItem token="--app-warning" label={tr("planner.legend.missingPrereq")} />
      </Stack>
    </Stack>
  );
}
