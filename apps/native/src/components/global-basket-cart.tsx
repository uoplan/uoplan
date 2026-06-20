import { BasketFab } from "@/components/basket-fab";
import { FabStack } from "@/components/redesign/fab";

/**
 * The app's persistent basket cart, mounted ONCE per tab stack (in each tab's
 * `_layout`) as a sibling of the navigator rather than inside individual
 * screens. Because it lives above the per-screen stack, it does NOT animate with
 * push/pop transitions — it stays pinned in the bottom-right corner like the
 * bottom tab bar, instead of sliding away when the user swipes back a page.
 */
export function GlobalBasketCart() {
  return (
    <FabStack>
      <BasketFab />
    </FabStack>
  );
}
