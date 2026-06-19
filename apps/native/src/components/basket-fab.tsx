import { useState } from "react";

import { BasketDrawer } from "@/components/basket-drawer";
import { Fab } from "@/components/redesign";
import { useBasket } from "@/data/basket-provider";

/**
 * The cart control: a circular Liquid-Glass floating action button with a live
 * count badge. It is meant to sit in a {@link FabStack} in the bottom-right
 * corner (passed via `RedesignScreen`'s `cart` prop) so it's easy to spot on
 * mobile. Tapping it opens the {@link BasketDrawer} in place rather than
 * navigating away.
 */
export function BasketFab() {
  const { count } = useBasket();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Fab icon="cart" accessibilityLabel="Basket" badge={count} onPress={() => setOpen(true)} />
      <BasketDrawer opened={open} onClose={() => setOpen(false)} />
    </>
  );
}
