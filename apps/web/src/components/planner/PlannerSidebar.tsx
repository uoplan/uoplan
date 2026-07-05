import { lazy, Suspense, useMemo } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCalendarDown,
  IconInfoCircle,
  IconLayoutGrid,
  IconSchool,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { formatTermLabel } from "../../lib/term/termLabel";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import { BackButton } from "../shared/BackButton";
import { usePlannerActions } from "./plannerActionsContext";
import { PlannerTermControls } from "./PlannerTermControls";
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
  /**
   * When the panel is docked as the "open in calendar" overlay sidebar: the
   * per-term tab hides its (now redundant) navigation, keeping only the tab
   * switcher + shared generation options.
   */
  calendarMode?: boolean;
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
    calendarMode = false,
  } = props;

  const actions = usePlannerActions();
  const enabledTermIds = useGraphPlannerStore((s) => s.enabledTermIds);
  const selectedTermId = useGraphPlannerStore((s) => s.selectedTermId);
  const anyDownloadable = useGraphPlannerStore((s) =>
    s.enabledTermIds.some((id) => Boolean(s.resultByTermId[id]?.currentSchedule)),
  );

  // Tabs: an always-present Overview plus one tab per enabled term. A term that
  // is selected (e.g. by clicking its node) but not yet enabled still gets a tab
  // so it can be configured / enabled from the panel.
  const tabTermIds = useMemo(() => {
    const ids = new Set(enabledTermIds);
    if (selectedTermId) ids.add(selectedTermId);
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }, [enabledTermIds, selectedTermId]);

  const activeTab = selectedTermId ?? "overview";

  return (
    <Stack gap="sm">
      <BackButton fallbackTo="/personalize" />

      <Tabs
        value={activeTab}
        onChange={(value) => actions.selectTerm(value && value !== "overview" ? value : null)}
        keepMounted={false}
      >
        <Tabs.List className={styles.panelTabsList}>
          <Tabs.Tab value="overview">{tr("planner.tabs.overview")}</Tabs.Tab>
          {tabTermIds.map((id) => (
            <Tabs.Tab key={id} value={id}>
              {formatTermLabel(id)}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="sm">
          <Stack gap="md">
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

            <Button
              size="sm"
              variant="light"
              leftSection={<IconCalendarDown size={16} />}
              disabled={!anyDownloadable}
              onClick={() => actions.downloadAllTerms()}
            >
              {tr("planner.download.all")}
            </Button>

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

            <Divider label={tr("planner.legend.title")} labelPosition="left" />
            <Stack gap={6}>
              <LegendItem token="--app-success" label={tr("planner.legend.completed")} />
              <LegendItem token="--app-accent" label={tr("planner.legend.planned")} />
              <LegendItem token="--app-warning" label={tr("planner.legend.missingPrereq")} />
            </Stack>
          </Stack>
        </Tabs.Panel>

        {tabTermIds.map((id) => (
          <Tabs.Panel key={id} value={id} pt="sm">
            <PlannerTermControls termId={id} calendarMode={calendarMode} />
          </Tabs.Panel>
        ))}
      </Tabs>

      {/* Cart + advanced options are shared across every term (they drive the
          main-store generation config that each term regenerates against), so
          they live once here, below the tabs, rather than per tab. */}
      {hasProgram ? (
        <>
          <Divider label={tr("planner.options.title")} labelPosition="left" />
          <Suspense fallback={<Skeleton height={220} radius="md" />}>
            <AdvancedGenerationOptions />
          </Suspense>
        </>
      ) : null}
    </Stack>
  );
}
