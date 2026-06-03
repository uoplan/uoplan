import { Group, NumberInput, Tooltip, ThemeIcon } from "@mantine/core";
import { IconHelpCircle } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";

interface RequirementPriorityControlProps {
  /** All requirement ids in the root's subtree; setting the control stamps every one of them. */
  requirementIds: string[];
}

/** The value shown for a subtree: the max priority among its requirement ids (default 0). */
export function priorityForIds(
  requirementIds: string[],
  priorities: Record<string, number>,
): number {
  return requirementIds.reduce((max, id) => Math.max(max, priorities[id] ?? 0), 0);
}

/** The patch applied when the control changes: stamp the chosen priority onto every id. */
export function stampPriorityForIds(
  requirementIds: string[],
  priority: number,
): Record<string, number> {
  return Object.fromEntries(requirementIds.map((id) => [id, priority]));
}

/**
 * Compact single-number priority picker shown in a requirement card header. The displayed value is
 * the max priority among the subtree's pools; changing it stamps that value onto every descendant.
 * A help icon explains the ordering (lower number = scheduled first; 0 = scheduled together).
 */
export function RequirementPriorityControl({ requirementIds }: RequirementPriorityControlProps) {
  const priorities = useAppStore((s) => s.requirementPriorities);
  const setRequirementPriorities = useAppStore((s) => s.setRequirementPriorities);

  const current = priorityForIds(requirementIds, priorities);

  return (
    <Group
      gap={6}
      wrap="nowrap"
      align="center"
      style={{ flexShrink: 0 }}
      // Keep clicks from toggling the surrounding collapsible card header.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Tooltip
        multiline
        w={260}
        withArrow
        label={tr("constrain.priority.help")}
        events={{ hover: true, focus: true, touch: true }}
      >
        <ThemeIcon
          variant="subtle"
          color="gray"
          size="xs"
          radius="xl"
          aria-label={tr("constrain.priority.help")}
          style={{ cursor: "help" }}
          tabIndex={0}
        >
          <IconHelpCircle size={15} />
        </ThemeIcon>
      </Tooltip>
      <NumberInput
        size="xs"
        w={62}
        min={0}
        max={9}
        clampBehavior="strict"
        allowDecimal={false}
        allowNegative={false}
        hideControls
        aria-label={tr("constrain.priority.label")}
        value={current}
        onChange={(value) => {
          const priority = typeof value === "number" ? value : Number(value) || 0;
          setRequirementPriorities(stampPriorityForIds(requirementIds, priority));
        }}
      />
    </Group>
  );
}
