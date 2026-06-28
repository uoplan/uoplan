import { useState } from "react";
import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconGripVertical } from "@tabler/icons-react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MAX_GOOD_BREAKS_COUNT,
  MAX_GOOD_BREAKS_TARGET_MINUTES,
  MIN_GOOD_BREAKS_COUNT,
  MIN_GOOD_BREAKS_TARGET_MINUTES,
} from "@uoplan/core";
import type { OptimizationKind, OptimizationPriority } from "@uoplan/core";
import { tr } from "../../../i18n";

export interface OptimizationPrioritiesCardProps {
  priorities: OptimizationPriority[];
  /** Up/down keyboard reorder — operates on stored indices. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Drag reorder — replaces the full ordered list. */
  onSetPriorities: (next: OptimizationPriority[]) => void;
  onToggle: (kind: OptimizationKind, enabled: boolean) => void;
  onGoodBreaksParamsChange: (params: { breakCount?: number; breakTargetMinutes?: number }) => void;
}

function optimizationLabel(kind: OptimizationKind): string {
  switch (kind) {
    case "free_days":
      return tr("optimize.freeDays.label");
    case "good_breaks":
      return tr("optimize.goodBreaks.label");
    case "prefer_easier":
      return tr("scheduleCount.preferEasier.label");
    case "prefer_sentiment":
      return tr("scheduleCount.preferSentiment.label");
    case "prefer_professor_rating":
      return tr("scheduleCount.preferProfessorRating.label");
  }
}

interface IndexedPriority {
  priority: OptimizationPriority;
  /** Position within the full (stored) priority list. */
  storedIndex: number;
}

/** Drag-handle props supplied by dnd-kit's `useSortable`, spread onto the grip. */
type HandleProps = Record<string, unknown>;

interface RowBodyProps {
  priority: OptimizationPriority;
  /** Slightly lifted presentation for the active drag overlay. */
  lifted?: boolean;
  /** Spread onto the grip handle. */
  handleProps?: HandleProps;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: (kind: OptimizationKind, enabled: boolean) => void;
  onGoodBreaksParamsChange: (params: { breakCount?: number; breakTargetMinutes?: number }) => void;
}

/** The visual content of a single priority row, reused by the sortable row and the drag overlay. */
function RowBody(props: RowBodyProps) {
  const { priority, lifted, handleProps, onToggle, onGoodBreaksParamsChange } = props;
  const isGoodBreaks = priority.kind === "good_breaks";
  return (
    <Box
      data-testid={`optimization-priority-${priority.kind}`}
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "var(--mantine-radius-md)",
        background: "var(--app-surface)",
        boxShadow: lifted ? "var(--mantine-shadow-md)" : undefined,
      }}
    >
      <Group wrap="nowrap" gap="xs" align="center" p="xs">
        <Box
          {...handleProps}
          aria-label={tr("optimize.dragHandle", { label: optimizationLabel(priority.kind) })}
          style={{
            display: "flex",
            cursor: "grab",
            color: "var(--app-text-muted)",
            flexShrink: 0,
            touchAction: "none",
          }}
        >
          <IconGripVertical size={16} aria-hidden="true" />
        </Box>
        <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0, whiteSpace: "normal" }}>
          {optimizationLabel(priority.kind)}
        </Text>
        <Stack gap={2} align="center" style={{ flexShrink: 0 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            disabled={!props.canMoveUp}
            aria-label={tr("optimize.moveUp")}
            onClick={props.onMoveUp}
          >
            <IconChevronUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            disabled={!props.canMoveDown}
            aria-label={tr("optimize.moveDown")}
            onClick={props.onMoveDown}
          >
            <IconChevronDown size={14} />
          </ActionIcon>
        </Stack>
        <Switch
          checked={priority.enabled}
          onChange={(e) => onToggle(priority.kind, e.currentTarget.checked)}
          aria-label={optimizationLabel(priority.kind)}
          style={{ flexShrink: 0 }}
        />
      </Group>

      {isGoodBreaks && priority.enabled ? (
        <Group gap="sm" px="xs" pb="xs" wrap="nowrap">
          <NumberInput
            size="xs"
            label={tr("optimize.goodBreaks.countLabel")}
            value={priority.breakCount ?? MIN_GOOD_BREAKS_COUNT}
            min={MIN_GOOD_BREAKS_COUNT}
            max={MAX_GOOD_BREAKS_COUNT}
            onChange={(v) => {
              if (typeof v !== "number" || Number.isNaN(v)) return;
              onGoodBreaksParamsChange({ breakCount: Math.trunc(v) });
            }}
            style={{ width: 110 }}
          />
          {(priority.breakCount ?? MIN_GOOD_BREAKS_COUNT) > 0 ? (
            <NumberInput
              size="xs"
              label={tr("optimize.goodBreaks.minutesLabel")}
              value={priority.breakTargetMinutes ?? MIN_GOOD_BREAKS_TARGET_MINUTES}
              min={MIN_GOOD_BREAKS_TARGET_MINUTES}
              max={MAX_GOOD_BREAKS_TARGET_MINUTES}
              step={15}
              onChange={(v) => {
                if (typeof v !== "number" || Number.isNaN(v)) return;
                onGoodBreaksParamsChange({ breakTargetMinutes: Math.trunc(v) });
              }}
              style={{ width: 140 }}
            />
          ) : null}
        </Group>
      ) : null}
    </Box>
  );
}

interface SortableRowProps {
  item: IndexedPriority;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: (kind: OptimizationKind, enabled: boolean) => void;
  onGoodBreaksParamsChange: (params: { breakCount?: number; breakTargetMinutes?: number }) => void;
}

/** A draggable priority row. While being dragged it is replaced in-flow by a dashed
 * placeholder of the *same dimensions* (the real row rendered invisibly), so the gap
 * matches the row; the lifted copy is rendered in the card's `DragOverlay`. */
function SortableRow(props: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.priority.kind,
  });

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          border: "1px dashed var(--app-border-strong)",
          borderRadius: "var(--mantine-radius-md)",
          background: "var(--app-surface-sunken)",
        }}
        aria-hidden="true"
      >
        <Box style={{ opacity: 0, pointerEvents: "none" }}>
          <RowBody
            priority={props.item.priority}
            canMoveUp={props.canMoveUp}
            canMoveDown={props.canMoveDown}
            onMoveUp={props.onMoveUp}
            onMoveDown={props.onMoveDown}
            onToggle={props.onToggle}
            onGoodBreaksParamsChange={props.onGoodBreaksParamsChange}
          />
        </Box>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <RowBody
        priority={props.item.priority}
        handleProps={{ ...attributes, ...listeners }}
        canMoveUp={props.canMoveUp}
        canMoveDown={props.canMoveDown}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        onToggle={props.onToggle}
        onGoodBreaksParamsChange={props.onGoodBreaksParamsChange}
      />
    </div>
  );
}

/**
 * The "Optimization priorities" card: a collapsible, ordered, individually-toggleable
 * list of generation objectives. Order = priority (higher rows win when goals conflict);
 * a disabled row stays in place in the ordering but is skipped during generation.
 * Rows reorder via drag (dnd-kit, animated gap + same-size drop placeholder) plus
 * keyboard-accessible up/down controls. The `good_breaks` row reveals inline
 * "N breaks of ~M minutes" inputs when enabled. Collapsed, the card shows the enabled
 * priorities numbered in order, with any disabled ones dimmed under a "disabled" heading.
 */
export function OptimizationPrioritiesCard(props: OptimizationPrioritiesCardProps) {
  const { priorities, onReorder, onSetPriorities, onToggle, onGoodBreaksParamsChange } = props;
  const [open, setOpen] = useState(true);
  const [activeKind, setActiveKind] = useState<OptimizationKind | null>(null);

  const indexed: IndexedPriority[] = priorities.map((priority, storedIndex) => ({
    priority,
    storedIndex,
  }));
  const allKinds = priorities.map((p) => p.kind);
  const enabledLabels = priorities.filter((p) => p.enabled).map((p) => optimizationLabel(p.kind));
  const disabledLabels = priorities.filter((p) => !p.enabled).map((p) => optimizationLabel(p.kind));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => setActiveKind(e.active.id as OptimizationKind);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveKind(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = allKinds.indexOf(active.id as OptimizationKind);
    const to = allKinds.indexOf(over.id as OptimizationKind);
    if (from < 0 || to < 0) return;
    onSetPriorities(arrayMove(priorities, from, to));
  };

  const activePriority = activeKind ? priorities.find((p) => p.kind === activeKind) : null;

  return (
    <Paper withBorder radius="md" p="sm" data-testid="optimization-priorities-card">
      <UnstyledButton
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ width: "100%" }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} size="sm">
              {tr("optimize.heading")}
            </Text>
            {open ? (
              <Text size="xs" c="dimmed">
                {tr("optimize.description")}
              </Text>
            ) : (
              <Stack gap={4} mt={2}>
                {enabledLabels.length > 0 ? (
                  <Stack gap={2}>
                    {enabledLabels.map((label, i) => (
                      <Group key={label} gap={6} wrap="nowrap" align="center">
                        <Text size="xs" fw={700} c="var(--app-accent)" style={{ flexShrink: 0 }}>
                          {i + 1}.
                        </Text>
                        <Text size="xs">{label}</Text>
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">
                    {tr("optimize.summary.allOff")}
                  </Text>
                )}
                {disabledLabels.length > 0 ? (
                  <Stack gap={2} mt={2}>
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                      {tr("optimize.disabledHeading")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {disabledLabels.join(" · ")}
                    </Text>
                  </Stack>
                ) : null}
              </Stack>
            )}
          </Stack>
          {open ? (
            <IconChevronUp size={16} style={{ flexShrink: 0, color: "var(--app-text-muted)" }} />
          ) : (
            <IconChevronDown size={16} style={{ flexShrink: 0, color: "var(--app-text-muted)" }} />
          )}
        </Group>
      </UnstyledButton>

      <Collapse expanded={open}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveKind(null)}
        >
          <SortableContext items={allKinds} strategy={verticalListSortingStrategy}>
            <Stack gap="xs" mt="sm">
              {indexed.map((item, displayIndex) => (
                <SortableRow
                  key={item.priority.kind}
                  item={item}
                  canMoveUp={displayIndex > 0}
                  canMoveDown={displayIndex < indexed.length - 1}
                  onMoveUp={() =>
                    onReorder(item.storedIndex, indexed[displayIndex - 1]!.storedIndex)
                  }
                  onMoveDown={() =>
                    onReorder(item.storedIndex, indexed[displayIndex + 1]!.storedIndex)
                  }
                  onToggle={onToggle}
                  onGoodBreaksParamsChange={onGoodBreaksParamsChange}
                />
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay>
            {activePriority ? (
              <RowBody
                priority={activePriority}
                lifted
                canMoveUp={false}
                canMoveDown={false}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                onToggle={onToggle}
                onGoodBreaksParamsChange={onGoodBreaksParamsChange}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </Collapse>
    </Paper>
  );
}
