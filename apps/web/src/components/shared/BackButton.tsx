import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { locationLabel } from "../../lib/navigation/backState";
import { usePreviousLocation } from "../../lib/navigation/navigationHistory";
import { useAppStore } from "../../store/appStore";

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
}: BackButtonProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const previous = usePreviousLocation();
  const professors = useAppStore((s) => s.professors);

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
