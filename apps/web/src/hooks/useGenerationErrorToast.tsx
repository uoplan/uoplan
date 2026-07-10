import { useEffect, useRef } from "react";
import { Anchor } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GenerationErrorState } from "@uoplan/store/types";
import { formatGenerationToastTitle } from "../lib/generationDiagnosticsText";
import { hasDetailContent } from "../lib/generationErrorDetail";
import { tr } from "../i18n";

/** True when there is more to show than the concise toast headline. */
function hasMoreDetail(error: GenerationErrorState): boolean {
  if (error.message.kind === "unassigned-completed") return true;
  return !!(error.details && hasDetailContent(error.details));
}

/**
 * Surfaces schedule-generation errors as a concise red toast (rather than a
 * blocking modal). The toast shows only the short headline plus a "View details"
 * link that opens {@link GenerationErrorModal} with the full diagnostics — this
 * keeps long messages (e.g. unassigned completed courses) from overflowing the
 * toast. Deduped by error-object reference: each generation attempt produces a
 * fresh {@link GenerationErrorState}, so a new error fires exactly one toast.
 */
export function useGenerationErrorToast(
  generationError: GenerationErrorState | null,
  onViewDetails?: (error: GenerationErrorState) => void,
): void {
  const lastShownRef = useRef<GenerationErrorState | null>(null);

  useEffect(() => {
    if (!generationError) {
      lastShownRef.current = null;
      return;
    }
    if (generationError === lastShownRef.current) return;
    lastShownRef.current = generationError;

    const showDetails = !!onViewDetails && hasMoreDetail(generationError);

    notifications.show({
      color: "red",
      title: formatGenerationToastTitle(generationError.message),
      message: showDetails ? (
        <Anchor
          component="button"
          type="button"
          size="sm"
          fw={600}
          onClick={() => onViewDetails(generationError)}
        >
          {tr("gen.viewDetails")}
        </Anchor>
      ) : undefined,
      autoClose: 10000,
    });
  }, [generationError, onViewDetails]);
}
