import { useEffect, useRef } from "react";
import { notifications } from "@mantine/notifications";
import type { GenerationErrorState } from "../store/types";
import { formatGenerationMessage } from "../lib/generationDiagnosticsText";
import { GenerationErrorDetailBlocks } from "../components/GenerationErrorDetailBlocks";

/**
 * Surfaces schedule-generation errors as a red toast (rather than a blocking
 * modal). Deduped by error-object reference: each generation attempt produces a
 * fresh {@link GenerationErrorState}, so a new error fires exactly one toast.
 */
export function useGenerationErrorToast(generationError: GenerationErrorState | null): void {
  const lastShownRef = useRef<GenerationErrorState | null>(null);

  useEffect(() => {
    if (!generationError) {
      lastShownRef.current = null;
      return;
    }
    if (generationError === lastShownRef.current) return;
    lastShownRef.current = generationError;

    const details = generationError.details;
    const summarizeEmptyPools = !!(
      details &&
      details.emptyPools.length > 4 &&
      details.totalAvailable < details.totalNeeded
    );

    notifications.show({
      color: "red",
      title: formatGenerationMessage(generationError.message),
      message: (
        <GenerationErrorDetailBlocks
          errorDetails={details}
          summarizeEmptyPools={summarizeEmptyPools}
        />
      ),
      autoClose: 10000,
    });
  }, [generationError]);
}
