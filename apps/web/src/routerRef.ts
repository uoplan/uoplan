/** Narrow router surface used outside React tree (hydration from Zustand, tour). */
type NavigateRouter = {
  navigate: (opts: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, unknown>;
    replace?: boolean;
  }) => Promise<void> | void;
};

let routerInstance: NavigateRouter | undefined;

export function setRouterInstance(r: NavigateRouter): void {
  routerInstance = r;
}

export function getRouterInstance(): NavigateRouter | undefined {
  return routerInstance;
}
