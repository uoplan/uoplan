import type { CSSProperties, MouseEventHandler } from "react";
import { ActionIcon, UnstyledButton } from "@mantine/core";
import type { MantineSize } from "@mantine/core";
import { IconCheck, IconGitCompare } from "@tabler/icons-react";
import { useTr } from "../../../i18n";
import { useAnalytics } from "../../../lib/analytics";
import { courseCompareRef, useCompareCount, useCompareMembership } from "../../../hooks/useCompare";
import classes from "./AddToCompareButton.module.css";

type AddToCompareButtonVariant = "icon" | "pill";

type AddToCompareButtonProps = {
  code: string;
  variant?: AddToCompareButtonVariant;
  size?: MantineSize;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
};

/**
 * "Add to compare" affordance for a course, mirroring {@link AddToBasketButton}.
 * Toggles the course in/out of the transient compare tray; disabled (with a
 * "compare up to N" hint) once the tray is full and this course is not in it.
 */
export function AddToCompareButton({
  code,
  variant = "icon",
  size,
  className,
  onClick,
  style,
}: AddToCompareButtonProps) {
  const tr = useTr();
  const analytics = useAnalytics();
  const ref = courseCompareRef(code);
  const { inCompare, atLimit, toggle } = useCompareMembership(ref);
  const count = useCompareCount();

  const label = inCompare
    ? tr("compare.added")
    : atLimit
      ? tr("compare.limitReached", { max: 4 })
      : tr("compare.add");
  const Icon = inCompare ? IconCheck : IconGitCompare;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (atLimit) return;
    onClick?.(event);
    analytics.capture(inCompare ? "compare_removed" : "compare_added", {
      kind: "course",
      id: code,
      count: inCompare ? count - 1 : count + 1,
    });
    toggle();
  };

  if (variant === "pill") {
    return (
      <UnstyledButton
        type="button"
        className={[classes.pillButton, className].filter(Boolean).join(" ")}
        aria-label={label}
        title={label}
        data-in-compare={inCompare}
        data-at-limit={atLimit}
        disabled={atLimit}
        onClick={handleClick}
        style={style}
      >
        <Icon size={16} stroke={inCompare ? 2.5 : 1.8} aria-hidden="true" />
        <span className={classes.pillLabel}>{label}</span>
      </UnstyledButton>
    );
  }

  return (
    <ActionIcon
      type="button"
      size={size ?? "sm"}
      variant="subtle"
      color={inCompare ? "teal" : "gray"}
      radius="md"
      className={[classes.iconButton, className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      data-in-compare={inCompare}
      data-at-limit={atLimit}
      disabled={atLimit}
      onClick={handleClick}
      style={style}
    >
      <Icon size={16} stroke={inCompare ? 2.5 : 1.8} aria-hidden="true" />
    </ActionIcon>
  );
}
