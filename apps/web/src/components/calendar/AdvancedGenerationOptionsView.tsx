import { Alert, Stack, Text } from "@mantine/core";
import { ConstrainStep } from "../requirements/ConstrainStep";
import type { ConstrainStepProps } from "../requirements/ConstrainStep";
import { GenerationOptionsFields } from "./generationOptions/GenerationOptionsFields";
import type { GenerationOptionsFieldsProps } from "./generationOptions/GenerationOptionsFields";
import { tr } from "../../i18n";

export interface AdvancedGenerationOptionsViewProps {
  /** The unified generation-option field set (shared with the basic sidebar), minus the disclosure. */
  fields: Omit<GenerationOptionsFieldsProps, "advancedOptions">;
  /** Everything the per-requirement "pick specific courses" panel needs. */
  constrain: ConstrainStepProps;
  /** Number of requirements with manual course picks (drives the "N picks" badge). */
  advancedPicksCount: number;
}

/**
 * Advanced (transcript) generation sidebar. Renders the same unified options as the basic sidebar;
 * the advanced-only "pick specific courses" step is appended inside the shared "Advanced options"
 * disclosure, and the picks count drives the disclosure's badge.
 */
export function AdvancedGenerationOptionsView({
  fields,
  constrain,
  advancedPicksCount,
}: AdvancedGenerationOptionsViewProps) {
  const badge =
    advancedPicksCount > 0
      ? {
          label: tr("advancedOptions.picksActive", { count: advancedPicksCount }),
          color: "accentBlue",
        }
      : { label: tr("app.constraints.optional"), color: "gray" };

  return (
    <Stack gap="md" data-testid="advanced-generation-options">
      <GenerationOptionsFields
        {...fields}
        advancedOptions={{
          collapseId: "advanced-options-collapse",
          badge,
          extraSummaryItem: tr("app.constraints.heading"),
          extraContent: (
            <Stack gap="sm" data-testid="constraints-panel">
              <Alert color="blue" variant="light" radius="md" style={{ border: "none" }}>
                <Text size="sm">{tr("advancedOptions.description")}</Text>
              </Alert>
              <ConstrainStep {...constrain} />
            </Stack>
          ),
        }}
      />
    </Stack>
  );
}
