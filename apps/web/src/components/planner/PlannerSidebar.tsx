import { lazy, Suspense } from "react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Skeleton,
  Stack,
  Text,
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
  } = props;

  return (
    <Stack gap="md">
      <BackButton fallbackTo="/personalize" />
      <div>
        <Group gap="xs" align="center">
          <Text fz="xl" fw={700}>
            {tr("planner.title")}
          </Text>
          <Badge size="sm" variant="light" color="grape">
            {tr("app.beta")}
          </Badge>
        </Group>
      </div>

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

      <Group gap="xs">
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconLayoutGrid size={16} />}
          onClick={onResetLayout}
        >
          {tr("planner.controls.resetLayout")}
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={16} />}
          disabled={isGenerating || !hasEnabledTerms}
          onClick={onClearPlan}
        >
          {tr("planner.clearPlan")}
        </Button>
      </Group>

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
