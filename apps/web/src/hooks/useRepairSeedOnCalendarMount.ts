import { useEffect } from "react";
import { flushPersistedAppState } from "../lib/persistAppState";
import { repairSeedPosition } from "../lib/seedNavigation";
import { useAppStore } from "../store/appStore";

/** Repair corrupt currentSeed (< firstSeed) when entering a calendar route. */
export function useRepairSeedOnCalendarMount(): void {
  useEffect(() => {
    const { firstSeed, currentSeed } = useAppStore.getState();
    const repaired = repairSeedPosition(firstSeed, currentSeed);
    if (repaired !== currentSeed) {
      useAppStore.setState({ currentSeed: repaired });
      flushPersistedAppState();
    }
  }, []);
}
