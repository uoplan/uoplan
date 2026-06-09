import { Anchor } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";

export function CatalogueLink({ href, label }: { href: string; label: string }) {
  return (
    <Anchor
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      c="dimmed"
      title={label}
      aria-label={label}
      display="inline-flex"
      style={{ alignItems: "center" }}
    >
      <IconExternalLink size={16} stroke={1.5} />
    </Anchor>
  );
}
