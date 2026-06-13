import { Modal as MantineModal } from "@mantine/core";

import type { ModalProps } from "./Modal.types";

/** Web (Mantine) implementation of the Modal contract. */
export function Modal({ opened, onClose, title, children, testID }: ModalProps) {
  return (
    <MantineModal opened={opened} onClose={onClose} title={title} data-testid={testID} centered>
      {children}
    </MantineModal>
  );
}
