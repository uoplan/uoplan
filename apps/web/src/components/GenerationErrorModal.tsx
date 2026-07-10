import { Modal, Stack, Text } from "@mantine/core";
import type { GenerationErrorState } from "@uoplan/store/types";
import { tr, useTr } from "../i18n";
import { formatGenerationMessage } from "../lib/generationDiagnosticsText";
import { GenerationErrorDetailBlocks } from "./GenerationErrorDetailBlocks";

/**
 * Full generation-error details, shown on demand from the concise error toast's
 * "View details" action. The toast stays short (just the headline); this modal
 * carries the full message (including any inlined course list) plus the
 * structured {@link GenerationErrorDetailBlocks}.
 */
export function GenerationErrorModal({
  error,
  onClose,
}: {
  error: GenerationErrorState | null;
  onClose: () => void;
}) {
  useTr();
  return (
    <Modal opened={!!error} onClose={onClose} title={tr("gen.modal.title")} centered size="lg">
      {error && (
        <Stack gap="sm">
          <Text size="sm">{formatGenerationMessage(error.message)}</Text>
          <GenerationErrorDetailBlocks errorDetails={error.details} summarizeEmptyPools={false} />
        </Stack>
      )}
    </Modal>
  );
}
