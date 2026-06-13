import { type Href, useRouter } from "expo-router";
import { usePathname } from "expo-router";
import { type ReactNode, useMemo } from "react";

import { type NavigationAdapter, NavigationProvider, routePath } from "@uoplan/navigation";

/**
 * Native shell adapter: implements the shared {@link NavigationAdapter} contract
 * on top of Expo Router. Shared screens from `@uoplan/app` call
 * `useNavigation()`; this provider translates typed routes into Expo `Href`s.
 * Navigation is wrapped defensively so tapping a destination whose native route
 * has not been ported yet logs a warning instead of crashing the demo.
 */
export function NativeNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const adapter = useMemo<NavigationAdapter>(
    () => ({
      navigate: (route, options) => {
        const href = routePath(route) as Href;
        try {
          if (options?.replace) router.replace(href);
          else router.push(href);
        } catch (error) {
          console.warn(`[navigation] no native route for ${String(href)}`, error);
        }
      },
      goBack: () => {
        if (router.canGoBack()) router.back();
      },
      canGoBack: () => router.canGoBack(),
      currentPath: () => pathname,
    }),
    [router, pathname],
  );

  return <NavigationProvider adapter={adapter}>{children}</NavigationProvider>;
}
