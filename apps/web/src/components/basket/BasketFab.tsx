import { useState } from "react";
import { ActionIcon, Affix, Box, Button, Group, Indicator, Popover } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { IconArrowRight, IconShoppingCart } from "@tabler/icons-react";
import { useBasketCount } from "../../hooks/useBasket";
import { tr, useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { BottomDrawer } from "../shared/BottomDrawer";
import { applyPillHover, resetPillHover } from "../shared/pillButtonStyle";
import { BasketContents } from "./BasketContents";

const I18N = {
  open: "basket.fab.open",
  openEmpty: "basket.fab.openEmpty",
  viewSchedule: "basket.cta.viewSchedule",
} as const;

// A circular chrome-style button (surface + border + soft shadow, like the theme
// and language pills) so the cart reads as a control rather than a bare glyph.
const cartButtonStyle = {
  background: "var(--app-surface)",
  border: "1px solid var(--app-border)",
  color: "var(--app-text)",
  boxShadow: "var(--app-shadow-sm)",
};

// Keep the count badge a perfect circle — Mantine's default pads the label and grows
// it into a rounded rectangle, so we pin equal width/height and a 50% radius.
const COUNT_BADGE_SIZE = 18;
const countIndicatorStyles = {
  indicator: {
    width: COUNT_BADGE_SIZE,
    minWidth: COUNT_BADGE_SIZE,
    height: COUNT_BADGE_SIZE,
    paddingInline: 0,
    borderRadius: "50%",
  },
} as const;

export function BasketFab({
  desktopPlacement = "top-right",
  inline = false,
}: {
  desktopPlacement?: "top-right" | "bottom-right";
  inline?: boolean;
}) {
  useTr();
  const [opened, setOpened] = useState(false);
  const count = useBasketCount();
  const navigate = useNavigate();
  const analytics = useAnalytics();
  // Mobile: a thumb-reachable floating button that opens the shared bottom drawer.
  // Desktop: a popover anchored to the cart, top-right on pages whose corner is free
  // (explore renders this inline; personalize floats it) and bottom-right where the
  // top-right is taken (trends' chrome controls, the graph's node panel).
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });

  const label = count === 0 ? tr(I18N.openEmpty) : tr(I18N.open, { count });
  const close = () => setOpened(false);
  const toggleOpened = () => {
    setOpened((value) => {
      if (!value) analytics.capture("basket_opened");
      return !value;
    });
  };
  const viewSchedule = () => {
    close();
    void navigate({ to: "/schedule" });
  };

  const footer = (fullWidth: boolean) => (
    <Group
      justify="flex-end"
      style={{
        padding: "12px 16px",
        borderTop: "var(--app-border-width) solid var(--app-border)",
      }}
    >
      <Button
        onClick={viewSchedule}
        fullWidth={fullWidth}
        rightSection={<IconArrowRight size={16} />}
      >
        {tr(I18N.viewSchedule)}
      </Button>
    </Group>
  );

  // Mobile: floating circular FAB + shared bottom drawer. When `inline`, the parent
  // owns positioning (e.g. the explore cart cluster), so skip the Affix wrapper.
  if (isMobile) {
    const mobileButton = (
      <Indicator
        label={count}
        size={COUNT_BADGE_SIZE}
        offset={6}
        color="var(--app-chart-1)"
        withBorder
        disabled={count === 0}
        styles={countIndicatorStyles}
      >
        <ActionIcon
          size={46}
          radius="xl"
          aria-label={label}
          title={label}
          onClick={() => {
            analytics.capture("basket_opened");
            setOpened(true);
          }}
          style={cartButtonStyle}
          onMouseEnter={(e) => applyPillHover(e.currentTarget)}
          onMouseLeave={(e) => resetPillHover(e.currentTarget)}
        >
          <IconShoppingCart size={22} aria-hidden />
        </ActionIcon>
      </Indicator>
    );
    return (
      <>
        {inline ? (
          mobileButton
        ) : (
          <Affix position={{ bottom: 24, right: 24 }} zIndex={150}>
            {mobileButton}
          </Affix>
        )}
        <BottomDrawer
          opened={opened}
          onClose={close}
          ariaLabel={label}
          maxHeight="80dvh"
          bodyStyle={{ display: "flex", flexDirection: "column", padding: 0 }}
        >
          <Box p="md" style={{ flex: 1 }}>
            <BasketContents variant="popover" onNavigate={close} />
          </Box>
          {footer(true)}
        </BottomDrawer>
      </>
    );
  }

  // Desktop: popover anchored to the cart button. Open the dropdown away from the
  // edge the button hugs.
  const floating = !inline && desktopPlacement === "bottom-right";
  const desktopBody = (
    <Indicator
      label={count}
      size={COUNT_BADGE_SIZE}
      offset={6}
      color="var(--app-chart-1)"
      withBorder
      disabled={count === 0}
      styles={countIndicatorStyles}
    >
      <Popover
        opened={opened}
        onChange={setOpened}
        position={floating ? "top-end" : "bottom-end"}
        offset={10}
        radius="lg"
        withinPortal
        trapFocus
        styles={{
          dropdown: {
            padding: 0,
            width: "min(360px, calc(100vw - 24px))",
            background: "var(--app-surface-overlay)",
            border: "var(--app-border-width) solid var(--app-border)",
            borderRadius: "var(--app-radius-lg)",
            boxShadow: "var(--app-shadow-lg)",
            overflow: "hidden",
          },
        }}
      >
        <Popover.Target>
          <ActionIcon
            size={38}
            radius="xl"
            aria-label={label}
            title={label}
            onClick={toggleOpened}
            style={cartButtonStyle}
            onMouseEnter={(e) => applyPillHover(e.currentTarget)}
            onMouseLeave={(e) => resetPillHover(e.currentTarget)}
          >
            <IconShoppingCart size={19} aria-hidden />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Box
            p="md"
            style={{ maxHeight: "min(70vh, 520px)", overflowY: "auto", overflowX: "hidden" }}
          >
            <BasketContents variant="popover" onNavigate={close} />
          </Box>
          {footer(false)}
        </Popover.Dropdown>
      </Popover>
    </Indicator>
  );

  if (inline) return desktopBody;

  return (
    <Affix position={floating ? { bottom: 24, right: 24 } : { top: 16, right: 16 }} zIndex={220}>
      {desktopBody}
    </Affix>
  );
}
