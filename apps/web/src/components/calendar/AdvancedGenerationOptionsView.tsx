import { useState } from "react";
import { Alert, Badge, Box, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { ConstrainStep, type ConstrainStepProps } from "../requirements/ConstrainStep";
import { ScheduleCountStep, type ScheduleCountStepProps } from "../steps/ScheduleCountStep";
import { tr } from "../../i18n";

export interface AdvancedGenerationOptionsViewProps {
  /** Everything `ScheduleCountStep` needs; the view owns `beforeGenerate`/`hideGenerateButton`. */
  scheduleCount: Omit<ScheduleCountStepProps, "beforeGenerate" | "hideGenerateButton">;
  /** Everything the constraints panel needs. */
  constrain: ConstrainStepProps;
}

/**
 * Prop-pure presentation for the advanced generation sidebar: the schedule-count
 * controls with a collapsible constraints panel injected before the (hidden)
 * generate button. Holds only the local collapse UI state.
 */
export function AdvancedGenerationOptionsView({
  scheduleCount,
  constrain,
}: AdvancedGenerationOptionsViewProps) {
  const [constrainOpen, setConstrainOpen] = useState(false);

  return (
    <Stack gap="md" data-testid="advanced-generation-options">
      <ScheduleCountStep
        {...scheduleCount}
        hideGenerateButton
        beforeGenerate={
          <Paper
            withBorder
            radius={0}
            data-testid="constraints-panel"
            style={{
              backgroundColor: constrainOpen
                ? "var(--mantine-color-dark-6)"
                : "var(--mantine-color-dark-8)",
            }}
          >
            <Group
              justify="space-between"
              align="center"
              p="sm"
              mb="xs"
              style={{ cursor: "pointer" }}
              onClick={() => setConstrainOpen((o) => !o)}
              aria-expanded={constrainOpen}
              aria-controls="constraints-collapse"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setConstrainOpen((o) => !o);
                }
              }}
            >
              <Group gap="xs" align="center">
                <IconChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    transform: constrainOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
                <Text fw={600} size="sm">
                  {tr("app.constraints.heading")}
                </Text>
              </Group>
              <Badge size="sm" variant="light" color="violet">
                {tr("app.constraints.optional")}
              </Badge>
            </Group>
            <Collapse id="constraints-collapse" expanded={!constrainOpen}>
              <Alert
                color="blue"
                variant="light"
                radius={0}
                mx="sm"
                mb="sm"
                style={{ border: "none" }}
              >
                <Text size="sm">{tr("app.constraints.description")}</Text>
              </Alert>
            </Collapse>
            <Collapse id="constraints-collapse-open" expanded={constrainOpen}>
              <Box p="sm" pt={0}>
                <ConstrainStep {...constrain} />
              </Box>
            </Collapse>
          </Paper>
        }
      />
    </Stack>
  );
}
