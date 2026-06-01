import { Modal } from "@mantine/core";
import { GenerationErrorDetailBlocks } from "../GenerationErrorDetailBlocks";
import type { GenerationErrorState } from "../../store/types";
import { useTr, tr } from "../../i18n";
import { formatGenerationMessage } from "../../lib/generationDiagnosticsText";

interface GenerationErrorModalProps {
  error: GenerationErrorState | null;
  onClose: () => void;
}

export function GenerationErrorModal({ error, onClose }: GenerationErrorModalProps) {
  useTr();
  const details = error?.details ?? null;
  const summarizeEmptyPools = !!(
    details &&
    details.emptyPools.length > 4 &&
    details.totalAvailable < details.totalNeeded
  );

  return (
    <Modal
      opened={!!error}
      onClose={onClose}
      title={error ? formatGenerationMessage(error.message) : tr("gen.modal.title")}
      size="lg"
      centered
      radius="md"
    >
      <GenerationErrorDetailBlocks
        errorDetails={details}
        summarizeEmptyPools={summarizeEmptyPools}
      />
    </Modal>
  );
}
