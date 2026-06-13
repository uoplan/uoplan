import { Group, NumberInput, ThemeIcon, Tooltip } from "@mantine/core";
import { IconHelpCircle } from "@tabler/icons-react";
import { useRequirementActions, useRequirementState } from "../../store/hooks";
import { tr } from "../../i18n";
import { priorityForIds, stampPriorityForIds } from "../../lib/requirements/requirementPriority";

interface RequirementPriorityControlProps {
  /** All requirement ids in the root's subtree; setting the control stamps every one of them. */
  requirementIds: string[];
}

/**
 * Compact single-number priority picker shown in a requirement card header. The displayed value is
 * the max priority among the subtree's pools; changing it stamps that value onto every descendant.
 * A help icon explains the ordering (lower number = scheduled first; 0 = scheduled together).
 */
export function RequirementPriorityControl({ requirementIds }: RequirementPriorityControlProps) {
  const { requirementPriorities: priorities } = useRequirementState();
  const { setRequirementPriorities } = useRequirementActions();

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
