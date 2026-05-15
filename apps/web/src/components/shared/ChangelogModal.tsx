import { useLingui } from "@lingui/react";
import { Box, Modal, ScrollArea } from "@mantine/core";
import { tr } from "../../i18n";
import changelogHtml from "virtual:changelog-html";

type ChangelogModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function ChangelogModal({ opened, onClose }: ChangelogModalProps) {
  useLingui();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tr("app.changelog.title")}
      centered
      radius={0}
      size="lg"
      styles={{
        header: {
          backgroundColor: "#1E1E20",
          borderBottom: "1px solid #2C2E33",
        },
        body: { backgroundColor: "#1E1E20", paddingTop: 12 },
        title: { color: "#F8F9FA", fontWeight: 600 },
        content: { maxHeight: "min(85dvh, 720px)" },
      }}
    >
      <ScrollArea.Autosize mah="min(70dvh, 560px)" type="auto" offsetScrollbars>
        <Box className="changelog-html" dangerouslySetInnerHTML={{ __html: changelogHtml }} />
      </ScrollArea.Autosize>
    </Modal>
  );
}
