import { useState } from "react";
import { Popover, UnstyledButton } from "@mantine/core";
import { IconHelpCircleFilled } from "@tabler/icons-react";
import type { ProfessorRegistry, UnpredictedInstructor } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { UnpredictedInstructorList } from "./UnpredictedInstructorList";

/**
 * A small "Why not others?" affordance overlaid on the bottom-right corner of an
 * unassigned section card. Opens a popover explaining why the course's other
 * historical instructors are not the build-time prediction (time conflict, stale,
 * not teaching this term…).
 *
 * Rendered as a sibling overlay of the selectable section-card button (never a
 * nested <button>); its click is stopped from bubbling so opening the popover
 * doesn't select the card. The dropdown's professor links render in a portal.
 */
export function WhyNotPredictedPopover({
  items,
  registry,
}: {
  items: UnpredictedInstructor[];
  registry: ProfessorRegistry | null;
}) {
  useTr();
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      width={260}
    >
      <Popover.Target>
        <UnstyledButton
          aria-label={tr("explore.schedule.whyNot.trigger")}
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            color: "var(--app-accent)",
            background: "var(--mantine-color-body)",
            boxShadow: "0 0 0 1px var(--app-border)",
          }}
        >
          <IconHelpCircleFilled size={15} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 280, overflowY: "auto" }}
      >
        <UnpredictedInstructorList
          items={items}
          registry={registry}
          onLinkClick={(e) => e.stopPropagation()}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
