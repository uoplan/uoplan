import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { locationLabel } from "../../lib/navigation/backState";
import type { BackState } from "../../lib/navigation/backState";
import { usePreviousLocation } from "../../lib/navigation/navigationHistory";

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
 * scroll — is restored. The label prefers an explicit `state.back.label` from
 * the referrer, then the central name of the globally-tracked previous location
 * (so e.g. arriving at Personalize from Explore reads "Course explorer", not
 * "Home"), then the fallback. Only a deep link / fresh load (no in-app history)
 * navigates to the logical parent instead.
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
  const back = useLocation({
    select: (s) => (s.state as { back?: BackState }).back,
  });
  const previous = usePreviousLocation();

  const historyLabel =
    canGoBack && previous ? locationLabel(previous.pathname, previous.search) : null;
  const label = back?.label ?? historyLabel ?? fallbackLabel ?? locationLabel(fallbackTo);

  const onBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({
      to: back?.to ?? fallbackTo,
      params: (back?.params ?? fallbackParams) as Record<string, string>,
      search: (back?.search ?? fallbackSearch) as never,
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
