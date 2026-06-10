import type { MouseEvent } from "react";
import { Anchor, Group, HoverCard, Stack, Text } from "@mantine/core";
import { IconExternalLink, IconMessage2, IconStar } from "@tabler/icons-react";
import { useTr } from "../../i18n";

type RatingKind = "rmp" | "satisfaction";

const ICON_BY_KIND = {
  rmp: IconStar,
  satisfaction: IconMessage2,
} as const;

/**
 * Compact rating chip used across explore surfaces (search cards, professor page
 * header, graph node details): an icon + `x.x/5` with a HoverCard popover that
 * explains the metric. `kind="rmp"` shows the RateMyProfessors star (with an
 * optional rating count and external link inside the popover); `kind="satisfaction"`
 * shows the course-feedback satisfaction icon.
 */
export function RatingBadge({
  kind,
  value,
  count,
  legacyId,
  size = 14,
}: {
  kind: RatingKind;
  value: number | null;
  count?: number | null;
  legacyId?: number | null;
  size?: number;
}) {
  const tr = useTr();
  const Icon = ICON_BY_KIND[kind];
  const label = kind === "rmp" ? tr("rating.rmp.label") : tr("rating.satisfaction.label");
  const explain =
    kind === "rmp"
      ? value == null
        ? tr("rating.rmp.unrated")
        : tr("rating.rmp.explain")
      : tr("rating.satisfaction.explain");
  const hasLink = kind === "rmp" && legacyId != null && Number.isFinite(legacyId) && legacyId > 0;
  const display = value != null && Number.isFinite(value) ? value.toFixed(1) : "?";

  return (
    <HoverCard
      width={240}
      shadow="md"
      radius="var(--app-radius-sm)"
      openDelay={80}
      withinPortal
      position="top"
    >
      <HoverCard.Target>
        <Group
          gap={4}
          wrap="nowrap"
          align="center"
          component="span"
          display="inline-flex"
          style={{ cursor: "help", verticalAlign: "middle" }}
        >
          <Icon size={size} stroke={1.6} color="var(--app-text-muted)" aria-hidden />
          <Text
            component="span"
            size="xs"
            fw={700}
            c="var(--app-text)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {tr("rating.value", { value: display })}
          </Text>
        </Group>
      </HoverCard.Target>
      <HoverCard.Dropdown
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{ cursor: "default" }}
      >
        <Stack gap={4}>
          <Group gap={6} wrap="nowrap" align="center">
            <Icon size={15} stroke={1.6} color="var(--app-text-muted)" aria-hidden />
            <Text size="xs" fw={700} c="var(--app-text)">
              {label}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" lh={1.4}>
            {explain}
          </Text>
          {kind === "rmp" && count != null ? (
            <Text size="xs" c="dimmed">
              {tr("rating.rmp.count", { count })}
            </Text>
          ) : null}
          {hasLink ? (
            <Anchor
              href={`https://www.ratemyprofessors.com/professor/${legacyId}`}
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              fw={600}
              c="var(--app-accent)"
              display="inline-flex"
              style={{ alignItems: "center", gap: 4 }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              {tr("rating.rmp.viewOn")}
              <IconExternalLink size={13} stroke={1.6} aria-hidden />
            </Anchor>
          ) : null}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
