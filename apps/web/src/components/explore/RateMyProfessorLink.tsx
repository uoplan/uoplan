import { Anchor } from "@mantine/core";
import { IconUserCircle } from "@tabler/icons-react";

export function RateMyProfessorLink({ legacyId }: { legacyId: number }) {
  return (
    <Anchor
      href={`https://www.ratemyprofessors.com/professor/${legacyId}`}
      target="_blank"
      rel="noopener noreferrer"
      c="dimmed"
      title="View on RateMyProfessors"
      display="inline-flex"
      style={{ alignItems: "center" }}
    >
      <IconUserCircle size={16} stroke={1.5} />
    </Anchor>
  );
}
