import { Modal, Box, Stack, Button } from "@mantine/core";
import { BasicCalendarSidebarControls } from "./BasicCalendarSidebarControls";
import { tr } from "../../i18n";

interface BasicGenerationOptionsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function BasicGenerationOptionsModal({ opened, onClose }: BasicGenerationOptionsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tr("app.generationOptions.title")}
      size="lg"
      radius={0}
      styles={{
        header: { backgroundColor: "#1E1E20", borderBottom: "1px solid #2C2E33" },
        body: { backgroundColor: "#1E1E20", padding: 0 },
        title: { color: "#F8F9FA", fontWeight: 600 },
      }}
    >
      <Box p="md">
        <Stack gap="md">
          <BasicCalendarSidebarControls />
          <Button variant="filled" color="violet" radius={0} fullWidth onClick={onClose}>
            {tr("basicCalendar.generate")}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}
