import { createContext, useContext, useEffect } from "react";

type ExploreBasketTargetValue = {
  code: string | null;
  setCode: (code: string | null) => void;
};

/**
 * Holds the course code the floating "add to basket" pill targets. The cart and its
 * pill live in the explore layout's top-right cluster, but only a course page knows
 * which course is being viewed — so course pages publish their code up here.
 */
export const ExploreBasketTargetContext = createContext<ExploreBasketTargetValue>({
  code: null,
  setCode: () => {},
});

/** The active basket target course code, or null when no course page is mounted. */
export function useExploreBasketTargetCode(): string | null {
  return useContext(ExploreBasketTargetContext).code;
}

/**
 * Publish a course code as the active basket target while the calling page is mounted,
 * clearing it on unmount so the floating pill only shows on course pages.
 */
export function usePublishBasketTarget(code: string | null): void {
  const { setCode } = useContext(ExploreBasketTargetContext);
  useEffect(() => {
    setCode(code);
  }, [code, setCode]);
  useEffect(() => () => setCode(null), [setCode]);
}
