import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/appStore";

/** Whether a single course code is currently in the basket ("courses you want"). */
function useInBasket(code: string): boolean {
  return useAppStore((s) => s.basketCourses.includes(code));
}

/** Number of courses currently in the basket. */
export function useBasketCount(): number {
  return useAppStore((s) => s.basketCourses.length);
}

/** The basket course list. */
export function useBasketCourses(): string[] {
  return useAppStore((s) => s.basketCourses);
}

/** The basket course list plus its full set of mutators ("courses you want"). */
export function useBasketSelection() {
  const basketCourses = useBasketCourses();
  const { setBasketCourses, addToBasket, removeFromBasket, toggleBasket, clearBasket } =
    useAppStore(
      useShallow((s) => ({
        setBasketCourses: s.setBasketCourses,
        addToBasket: s.addToBasket,
        removeFromBasket: s.removeFromBasket,
        toggleBasket: s.toggleBasket,
        clearBasket: s.clearBasket,
      })),
    );
  return {
    basketCourses,
    setBasketCourses,
    addToBasket,
    removeFromBasket,
    toggleBasket,
    clearBasket,
  };
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
