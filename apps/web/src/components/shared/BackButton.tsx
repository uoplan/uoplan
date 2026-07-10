import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { locationLabel } from "../../lib/navigation/backState";
import { usePreviousLocation } from "../../lib/navigation/navigationHistory";
import { useProfessorRegistry } from "@uoplan/store/hooks";
import styles from "./BackButton.module.css";

type BackButtonProps = {
  /** Logical parent to navigate to when there is no in-app history to pop. */
  fallbackTo: string;
  /**
   * Label for the no-history case. Defaults to the central name for `fallbackTo`,
   * so callers only override it when the logical parent needs a custom name.
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

/**
 * Cohesive back affordance: chevron + label naming the destination.
 *
 * When the current entry was reached via an in-app navigation it pops browser
 * history (`router.history.back()`) so the exact prior URL — query, filters,
 * scroll — is restored. The label is the central name of the globally-tracked
 * previous location (so e.g. arriving at Personalize from Explore reads
 * "Search results for …", not "Home"). Only a deep link / fresh load (no in-app
 * history) navigates to the logical parent instead, labelled from it.
 */
export function BackButton({
  fallbackTo,
  fallbackLabel,
  fallbackParams,
  fallbackSearch,
  emphasis = "subtle",
}: BackButtonProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const previous = usePreviousLocation();
  const professors = useProfessorRegistry();

  const historyLabel =
    canGoBack && previous ? locationLabel(previous.pathname, previous.search, professors) : null;
  const label = historyLabel ?? fallbackLabel ?? locationLabel(fallbackTo);

  const onBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
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
