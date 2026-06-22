import type { CSSProperties, MouseEventHandler } from "react";
import { ActionIcon, UnstyledButton } from "@mantine/core";
import type { MantineSize } from "@mantine/core";
import { IconCheck, IconShoppingCartPlus } from "@tabler/icons-react";
import { useTr } from "../../i18n";
import { useBasketMembership } from "../../hooks/useBasket";
import { useAnalytics } from "../../lib/analytics";
import classes from "./AddToBasketButton.module.css";

type AddToBasketButtonVariant = "icon" | "pill";

type AddToBasketButtonProps = {
  code: string;
  variant?: AddToBasketButtonVariant;
  size?: MantineSize;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
};

export function AddToBasketButton({
  code,
  variant = "icon",
  size,
  className,
  onClick,
  style,
}: AddToBasketButtonProps) {
  const tr = useTr();
  const analytics = useAnalytics();
  const { inBasket, toggle } = useBasketMembership(code);
  const label = inBasket ? tr("basket.added") : tr("basket.add");
  const ariaLabel = inBasket ? tr("basket.added.aria") : tr("basket.add.aria");
  const Icon = inBasket ? IconCheck : IconShoppingCartPlus;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    analytics.capture(inBasket ? "basket_course_removed" : "basket_course_added", {
      courseCode: code,
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
        data-in-basket={inBasket}
        onClick={handleClick}
        style={style}
      >
        <Icon size={16} stroke={inBasket ? 2.5 : 1.8} aria-hidden="true" />
        <span className={classes.pillLabel}>{label}</span>
      </UnstyledButton>
    );
  }

  return (
    <ActionIcon
      type="button"
      size={size ?? "sm"}
      variant="subtle"
      color={inBasket ? "teal" : "gray"}
      radius="md"
      className={[classes.iconButton, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-in-basket={inBasket}
      onClick={handleClick}
      style={style}
    >
      <Icon size={16} stroke={inBasket ? 2.5 : 1.8} aria-hidden="true" />
    </ActionIcon>
  );
}
