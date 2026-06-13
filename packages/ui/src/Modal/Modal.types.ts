import type { ReactNode } from "react";

/**
 * Shared prop contract for the Modal primitive — a centred overlay dialog. Web
 * maps onto Mantine's `Modal`; native maps onto a React Native `Modal` with a
 * dimmed backdrop and a centred card.
 */
export interface ModalProps {
  /** Whether the modal is visible. */
  opened: boolean;
  /** Fired when the user dismisses the modal (backdrop tap / close button). */
  onClose: () => void;
  /** Optional header title. */
  title?: string;
  children?: ReactNode;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
