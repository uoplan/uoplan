import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";

import type { AppRoute } from "./routes";

/** Options accepted by {@link NavigationAdapter.navigate}. */
export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/**
 * The navigation port that each shell implements. Shared screens depend ONLY on
 * this interface (via {@link useNavigation}), never on a concrete router. The
 * web shell backs it with TanStack Router; the native shell with Expo Router.
 */
export interface NavigationAdapter {
  /** Navigate to a typed route. */
  navigate: (route: AppRoute, options?: NavigateOptions) => void;
  /** Pop the current screen, if possible. */
  goBack: () => void;
  /** Whether there is a previous entry to go back to. */
  canGoBack: () => boolean;
  /** The current absolute path (used for active-state checks). */
  currentPath: () => string;
}

const NavigationContext = createContext<NavigationAdapter | null>(null);

/** Provide a platform {@link NavigationAdapter} to the shared screen tree. */
export function NavigationProvider({
  adapter,
  children,
}: {
  adapter: NavigationAdapter;
  children: ReactNode;
}) {
  return createElement(NavigationContext.Provider, { value: adapter }, children);
}

/**
 * Access the active {@link NavigationAdapter}. Throws when used outside a
 * {@link NavigationProvider} so a missing adapter fails loudly in development.
 */
export function useNavigation(): NavigationAdapter {
  const adapter = useContext(NavigationContext);
  if (adapter === null) {
    throw new Error("useNavigation must be used within a <NavigationProvider>.");
  }
  return adapter;
}

/** Convenience hook returning just the `navigate` function. */
export function useNavigate(): NavigationAdapter["navigate"] {
  return useNavigation().navigate;
}
