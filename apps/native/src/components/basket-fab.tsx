import { useState } from "react";

import { BasketDrawer } from "@/components/basket-drawer";
import { Fab } from "@/components/redesign/fab";
import { useBasket } from "@/data/basket-provider";
import { useBasketStatus } from "@/lib/use-basket-status";

/**
 * The cart control: a circular Liquid-Glass floating action button with a live
 * count badge. It is meant to sit in a {@link FabStack} in the bottom-right
 * corner so it's easy to spot on mobile. When the basket contains a course with
 * a problem (unmet prerequisites or not offered this term) the badge flips to a
 * warning "!" instead of the count, hinting the user to open the cart. Tapping
 * it opens the {@link BasketDrawer} in place rather than navigating away.
 */
export function BasketFab() {
  const { count } = useBasket();
  const { hasIssue } = useBasketStatus();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Fab
        icon="cart"
        accessibilityLabel={hasIssue ? "Basket (needs attention)" : "Basket"}
        badge={count}
        alert={count > 0 && hasIssue}
        onPress={() => setOpen(true)}
      />
      <BasketDrawer opened={open} onClose={() => setOpen(false)} />
    </>
  );
}
