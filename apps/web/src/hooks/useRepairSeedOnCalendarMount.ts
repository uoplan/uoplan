import { useEffect } from "react";
import { flushPersistedAppState } from "../lib/persistAppState";
import { repairSeedPosition } from "../lib/seedNavigation";
import { useAppStoreApi } from "../store/appStore";

/** Repair corrupt currentSeed (< firstSeed) when entering a calendar route. */
export function useRepairSeedOnCalendarMount(): void {
  const storeApi = useAppStoreApi();
  useEffect(() => {
    const { firstSeed, currentSeed } = storeApi.getState();
    const repaired = repairSeedPosition(firstSeed, currentSeed);
    if (repaired !== currentSeed) {
      storeApi.setState({ currentSeed: repaired });
      flushPersistedAppState();
    }
  }, [storeApi]);
}
