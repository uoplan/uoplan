import { Modal } from "@mantine/core";
import { GenerationErrorDetailBlocks } from "../GenerationErrorDetailBlocks";
import type { GenerationErrorState } from "../../store/types";

interface GenerationErrorModalProps {
  error: GenerationErrorState | null;
  onClose: () => void;
}

export function GenerationErrorModal({ error, onClose }: GenerationErrorModalProps) {
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
      title={error?.message ?? "Generation error"}
      size="lg"
      centered
      radius={0}
    >
      <GenerationErrorDetailBlocks
        errorDetails={details}
        summarizeEmptyPools={summarizeEmptyPools}
      />
    </Modal>
  );
}
