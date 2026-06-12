import { useAppStore } from "../store/appStore";

/** Whether a single course code is currently in the basket ("courses you want"). */
function useInBasket(code: string): boolean {
  return useAppStore((s) => s.basketCourses.includes(code));
}

/** Number of courses currently in the basket. */
export function useBasketCount(): number {
  return useAppStore((s) => s.basketCourses.length);
}

/**
 * Membership + mutation helpers for a single course code, for "add to basket" affordances.
 * Re-renders only when this code's membership changes.
 */
export function useBasketMembership(code: string) {
  const inBasket = useInBasket(code);
  const toggleBasket = useAppStore((s) => s.toggleBasket);
  const addToBasket = useAppStore((s) => s.addToBasket);
  const removeFromBasket = useAppStore((s) => s.removeFromBasket);
  return {
    inBasket,
    toggle: () => toggleBasket(code),
    add: () => addToBasket(code),
    remove: () => removeFromBasket(code),
  };
}
