import { create } from "zustand";

/**
 * Tiny standalone store that defers loading the command center (and the
 * `@mantine/spotlight` dependency it pulls in) until the user first invokes it.
 *
 * `requestOpen` is called by the footer button and the lightweight `mod + K`
 * listener in {@link LazyCommandCenter}; it both flips `activated` (mounting the
 * real component) and bumps `openSignal` so the mounted Spotlight opens.
 */
type CommandCenterState = {
  /** Incremented on every open request so the mounted Spotlight can react. */
  openSignal: number;
  /** True once the command center has been activated and its chunk loaded. */
  activated: boolean;
  requestOpen: () => void;
};

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  openSignal: 0,
  activated: false,
  requestOpen: () => set((s) => ({ openSignal: s.openSignal + 1, activated: true })),
}));
