import { useMemo } from "react";
import type { ReactNode } from "react";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";

import { NavigationProvider, routePath } from "@uoplan/navigation";
import type { NavigationAdapter } from "@uoplan/navigation";
import { withBasepath } from "./basepath";

/**
 * Web shell adapter: implements the shared {@link NavigationAdapter} contract on
 * top of TanStack Router. Shared screens from `@uoplan/app` call
 * `useNavigation()`; this provider translates typed routes into path strings and
 * drives TanStack's history. Using `router.history` (rather than the typed
 * `navigate`) lets us pass the already-built path string directly.
 */
export function WebNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const location = useLocation();

  const adapter = useMemo<NavigationAdapter>(
    () => ({
      navigate: (route, options) => {
        // `routePath` is basepath-relative, matching what `useLocation()` reports.
        // `router.history` is the raw browser history, so unlike `router.navigate`
        // it does not prepend the school basepath — do it here.
        const path = withBasepath(router.basepath, routePath(route));
        if (options?.replace) router.history.replace(path);
        else router.history.push(path);
      },
      goBack: () => router.history.back(),
      canGoBack: () => canGoBack,
      currentPath: () => location.pathname,
    }),
    [router, canGoBack, location.pathname],
  );

  return <NavigationProvider adapter={adapter}>{children}</NavigationProvider>;
}
