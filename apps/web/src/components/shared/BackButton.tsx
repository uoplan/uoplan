import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { locationLabel } from "../../lib/navigation/backState";
import { useProfessorRegistry } from "@uoplan/store/hooks";
import styles from "./BackButton.module.css";

type BackButtonProps = {
  /** Logical parent this button always navigates to. */
  fallbackTo: string;
  /**
   * Label to show. Defaults to the central name for `fallbackTo` (with any
   * `fallbackParams` interpolated into it first, e.g. `$course` -> the actual
   * code), so callers only override it when the logical parent needs a custom
   * name that can't be derived from its path alone.
   */
  fallbackLabel?: string;
  fallbackParams?: Record<string, string>;
  fallbackSearch?: Record<string, unknown>;
  /**
   * Visual weight. `"subtle"` (default) is the quiet dimmed chevron+label used on
   * most detail pages. `"prominent"` renders a clearly-tappable bordered pill with
   * non-dimmed text, for pages where the back affordance is otherwise easy to miss.
   */
  emphasis?: "subtle" | "prominent";
};

function interpolateParams(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  return path.replaceAll(/\$(\w+)/g, (match, key: string) => params[key] ?? match);
}

/**
 * Cohesive back affordance: chevron + label naming the destination.
 *
 * Always navigates to the caller-supplied logical parent (`fallbackTo`) rather
 * than popping browser history — a page reached via a deep link, a share link,
 * or an in-app click all back out to the same predictable place. The label
 * defaults to the central name for that destination.
 */
export function BackButton({
  fallbackTo,
  fallbackLabel,
  fallbackParams,
  fallbackSearch,
  emphasis = "subtle",
}: BackButtonProps) {
  const navigate = useNavigate();
  const professors = useProfessorRegistry();

  const label =
    fallbackLabel ??
    locationLabel(interpolateParams(fallbackTo, fallbackParams), undefined, professors);

  const onBack = () => {
    void navigate({
      to: fallbackTo,
      params: fallbackParams as Record<string, string>,
      search: fallbackSearch as never,
      replace: true,
    } as never);
  };

  if (emphasis === "prominent") {
    return (
      <UnstyledButton
        onClick={onBack}
        className={styles.prominent}
        style={{
          alignSelf: "flex-start",
          color: "var(--app-text)",
          border: "1px solid var(--app-border)",
          borderRadius: "var(--mantine-radius-xl)",
          padding: "6px 14px 6px 10px",
          backgroundColor: "var(--app-surface)",
        }}
      >
        <Group gap={6} wrap="nowrap">
          <IconChevronLeft size={16} stroke={2} />
          <Text size="sm" fw={500} c="var(--app-text)">
            {label}
          </Text>
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      onClick={onBack}
      style={{ alignSelf: "flex-start", color: "var(--mantine-color-dimmed)" }}
    >
      <Group gap={2} wrap="nowrap">
        <IconChevronLeft size={15} stroke={1.8} />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
