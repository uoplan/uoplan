import { lazy, Suspense, useEffect } from "react";
import { useCommandCenterStore } from "../../store/commandCenterStore";

const CommandCenter = lazy(() =>
  // oxlint-disable-next-line promise/prefer-await-to-then -- dynamic-import mapping for React.lazy; keeps the named-export usage traceable
  import("./CommandCenter").then((mod) => ({ default: mod.CommandCenter })),
);

/** True for a Cmd/Ctrl+K keypress made outside an editable field. */
function isCommandCenterShortcut(event: KeyboardEvent): boolean {
  if (event.altKey || event.shiftKey) return false;
  if (!(event.metaKey || event.ctrlKey)) return false;
  return event.key === "k" || event.key === "K";
}

/**
 * Defers mounting the command center (and the `@mantine/spotlight` chunk) until
 * the user first opens it. Until then a tiny `mod + K` listener stands in for
 * Spotlight's own shortcut; once activated, Spotlight owns the shortcut and this
 * listener detaches.
 */
export function LazyCommandCenter() {
  const activated = useCommandCenterStore((s) => s.activated);

  useEffect(() => {
    if (activated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCommandCenterShortcut(event)) return;
      event.preventDefault();
      useCommandCenterStore.getState().requestOpen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activated]);

  if (!activated) return null;
  return (
    <Suspense fallback={null}>
      <CommandCenter />
    </Suspense>
  );
}
