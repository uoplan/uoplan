import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/** localStorage flush status: last-saved timestamp + whether a save is pending. */
export function useSaveStatus() {
  return useAppStore(
    useShallow((s) => ({
      lastSavedAt: s.lastSavedAt,
      hasPendingSave: s.hasPendingSave,
    })),
  );
}
