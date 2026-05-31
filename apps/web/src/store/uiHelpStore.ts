import { create } from "zustand";

/**
 * Tiny standalone store for the keyboard-shortcuts help overlay. Kept separate
 * from the main app store so the `?` hotkey and the discoverability button can
 * toggle it without threading props through the tree.
 */
type HelpModalState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useHelpModalStore = create<HelpModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
