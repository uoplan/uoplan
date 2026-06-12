import type { CSSProperties, MouseEventHandler } from "react";
import { ActionIcon, Button } from "@mantine/core";
import type { MantineSize } from "@mantine/core";
import { IconCheck, IconShoppingCartPlus } from "@tabler/icons-react";
import { useTr } from "../../i18n";
import { useBasketMembership } from "../../hooks/useBasket";
import classes from "./AddToBasketButton.module.css";

type AddToBasketButtonVariant = "icon" | "labeled";

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
  const { inBasket, toggle } = useBasketMembership(code);
  const label = inBasket ? tr("basket.added") : tr("basket.add");
  const ariaLabel = inBasket ? tr("basket.added.aria") : tr("basket.add.aria");
  const Icon = inBasket ? IconCheck : IconShoppingCartPlus;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    toggle();
  };

  if (variant === "labeled") {
    return (
      <Button
        type="button"
        size={size ?? "sm"}
        variant={inBasket ? "light" : "default"}
        color={inBasket ? "teal" : "gray"}
        leftSection={<Icon size={16} stroke={inBasket ? 2.5 : 1.8} aria-hidden="true" />}
        className={[classes.labeledButton, className].filter(Boolean).join(" ")}
        aria-label={label}
        title={label}
        onClick={handleClick}
        style={style}
      >
        {label}
      </Button>
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
