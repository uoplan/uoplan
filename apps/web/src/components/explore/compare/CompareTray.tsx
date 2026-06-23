import { ActionIcon, Affix, Group, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { IconGitCompare, IconX } from "@tabler/icons-react";
import { compareIdsForKind } from "@uoplan/core";
import { useTr } from "../../../i18n";
import { useAnalytics } from "../../../lib/analytics";
import { EMPTY_EXPLORE_SEARCH } from "../../../lib/explore/exploreFilters";
import { useCompareRefs, useCompareSelection } from "../../../hooks/useCompare";
import classes from "./CompareTray.module.css";

/**
 * Floating "Compare (N)" entry point, shown bottom-left while at least one course
 * is staged in the transient compare tray (kept clear of the cart cluster, which
 * hugs the bottom-right). Navigates to the shareable compare route with the staged
 * ids; a trailing ✕ clears the tray. Rendered once by {@link ExploreLayout}.
 */
export function CompareTray() {
  const tr = useTr();
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const refs = useCompareRefs();
  const { clearCompare } = useCompareSelection();
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });

  if (refs.length === 0) return null;

  const kind = refs[0]?.kind ?? "course";
  const ids = compareIdsForKind(refs, kind);
  const label = tr("compare.cta", { count: ids.length });

  const open = () => {
    analytics.capture("compare_opened", { kind, count: ids.length });
    void navigate({
      to: "/explore/compare/$resource",
      params: { resource: kind },
      search: { ...EMPTY_EXPLORE_SEARCH, ids: ids.join(",") },
    });
  };

  const clear = () => {
    analytics.capture("compare_cleared", { kind, count: ids.length });
    clearCompare();
  };

  return (
    <Affix position={{ bottom: 24, left: 24 }} zIndex={150}>
      <Group gap={6} align="center" wrap="nowrap" className={classes.tray}>
        <UnstyledButton
          type="button"
          className={classes.openButton}
          onClick={open}
          aria-label={label}
          title={label}
        >
          <IconGitCompare size={16} stroke={1.8} aria-hidden="true" />
          <span className={classes.label}>{label}</span>
        </UnstyledButton>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="xl"
          size={isMobile ? "md" : "sm"}
          onClick={clear}
          aria-label={tr("compare.clear")}
          title={tr("compare.clear")}
        >
          <IconX size={15} stroke={1.8} aria-hidden="true" />
        </ActionIcon>
      </Group>
    </Affix>
  );
}
