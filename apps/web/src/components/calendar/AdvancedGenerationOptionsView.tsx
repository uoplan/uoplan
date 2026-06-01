import { useState } from "react";
import { Alert, Badge, Box, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { ConstrainStep, type ConstrainStepProps } from "../requirements/ConstrainStep";
import {
  GenerationOptionsFields,
  type GenerationOptionsFieldsProps,
} from "./generationOptions/GenerationOptionsFields";
import { tr } from "../../i18n";

export interface AdvancedGenerationOptionsViewProps {
  /** The unified generation-option field set (shared with the basic sidebar). */
  fields: GenerationOptionsFieldsProps;
  /** Everything the per-requirement "pick specific courses" panel needs. */
  constrain: ConstrainStepProps;
  /** Number of requirements with manual course picks (drives the "N picks active" badge). */
  advancedPicksCount: number;
}

/**
 * Advanced (transcript) generation sidebar. Renders the same unified options as the basic sidebar,
 * plus the advanced-only "pick specific courses" panel tucked behind a collapsed "Advanced options"
 * disclosure. Holds only the local collapse UI state.
 */
export function AdvancedGenerationOptionsView({
  fields,
  constrain,
  advancedPicksCount,
}: AdvancedGenerationOptionsViewProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <Stack gap="md" data-testid="advanced-generation-options">
      <GenerationOptionsFields {...fields} />

      <Paper
        withBorder
        radius="md"
        data-testid="constraints-panel"
        style={{
          backgroundColor: advancedOpen ? "var(--app-surface)" : "var(--app-surface-sunken)",
        }}
      >
        <Group
          justify="space-between"
          align="center"
          p="sm"
          style={{ cursor: "pointer" }}
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          aria-controls="advanced-options-collapse"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAdvancedOpen((o) => !o);
            }
          }}
        >
          <Group gap="xs" align="center">
            <IconChevronDown
              size={14}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                transform: advancedOpen ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 150ms ease",
              }}
            />
            <Text fw={600} size="sm">
              {tr("advancedOptions.heading")}
            </Text>
          </Group>
          {advancedPicksCount > 0 ? (
            <Badge size="sm" variant="light" color="accentBlue">
              {tr("advancedOptions.picksActive", { count: advancedPicksCount })}
            </Badge>
          ) : (
            <Badge size="sm" variant="light" color="gray">
              {tr("app.constraints.optional")}
            </Badge>
          )}
        </Group>
        <Collapse id="advanced-options-collapse" expanded={advancedOpen}>
          <Box p="sm" pt={0}>
            <Alert color="blue" variant="light" radius="md" mb="sm" style={{ border: "none" }}>
              <Text size="sm">{tr("advancedOptions.description")}</Text>
            </Alert>
            <ConstrainStep {...constrain} />
          </Box>
        </Collapse>
      </Paper>
    </Stack>
  );
}
