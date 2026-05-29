import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { BackState } from "../../lib/navigation/backState";

export type BackButtonProps = {
  /** Logical parent to navigate to when there is no in-app history to pop. */
  fallbackTo: string;
  /** Label shown when the originating page did not provide a back label. */
  fallbackLabel: string;
  fallbackParams?: Record<string, string>;
  fallbackSearch?: Record<string, unknown>;
};

/**
 * Cohesive back affordance: chevron + label naming the destination.
 *
 * Prefers popping browser history (`router.history.back()`) when the current
 * entry was reached via an in-app forward navigation that attached
 * `state.back`. Otherwise (deep link / fresh load) it navigates to the logical
 * parent. Because `state.back` is set by the referrer, the label always matches
 * where the pop actually lands.
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

  const label = back?.label ?? fallbackLabel;

  const onBack = () => {
    if (back && canGoBack) {
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
