import { useState } from "react";

import { BasketDrawer } from "@/components/basket-drawer";
import { GlassIconButton } from "@/components/redesign";
import { useBasket } from "@/data/basket-provider";

/**
 * The cart control for the global header cluster: a circular Liquid-Glass icon
 * button (matching the settings gear and back arrow) with a live count badge,
 * sitting directly left of the settings gear. Tapping it opens the
 * {@link BasketDrawer} in place rather than navigating away — the same behaviour
 * as the old bottom cart FAB, just relocated into the top header row.
 */
export function BasketHeaderButton() {
  const { count } = useBasket();
  const [open, setOpen] = useState(false);
  return (
    <>
      <GlassIconButton
        icon="cart"
        accessibilityLabel="Basket"
        badge={count}
        onPress={() => setOpen(true)}
      />
      <BasketDrawer opened={open} onClose={() => setOpen(false)} />
    </>
  );
}
