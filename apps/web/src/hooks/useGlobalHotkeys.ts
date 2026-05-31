import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { destinationForNavKey } from "../lib/navigation/appDestinations";
import { useHelpModalStore } from "../store/uiHelpStore";

/** Leader key that begins a quick-nav sequence (e.g. `g` then `e` → Explore). */
const LEADER_KEY = "g";
/** Window (ms) after the leader key during which the destination key is accepted. */
const SEQUENCE_TIMEOUT_MS = 1200;

/** True when the event target is an editable field where shortcuts must not fire. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Registers global keyboard shortcuts: a `g`-leader quick-nav sequence to jump
 * between top-level pages, and `?` to open the keyboard-shortcuts help overlay.
 * The command center's own `mod + K` shortcut is owned by Spotlight, not here.
 *
 * Call once near the root of the tree (inside the router).
 */
export function useGlobalHotkeys() {
  const navigate = useNavigate();
  const leaderActiveRef = useRef(false);
  const leaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearLeader = () => {
      leaderActiveRef.current = false;
      if (leaderTimeoutRef.current !== null) {
        clearTimeout(leaderTimeoutRef.current);
        leaderTimeoutRef.current = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Never hijack browser/OS shortcuts; `mod + K` belongs to Spotlight.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      // `?` (Shift + /) opens the help overlay from anywhere.
      if (event.key === "?") {
        event.preventDefault();
        clearLeader();
        useHelpModalStore.getState().open();
        return;
      }

      // Don't run quick-nav while the help overlay is open or for held keys.
      if (event.shiftKey || event.repeat) return;
      if (useHelpModalStore.getState().isOpen) return;

      const key = event.key.toLowerCase();

      if (leaderActiveRef.current) {
        const destination = destinationForNavKey(key);
        clearLeader();
        if (destination) {
          event.preventDefault();
          void navigate({ to: destination.to });
        }
        return;
      }

      if (key === LEADER_KEY) {
        leaderActiveRef.current = true;
        leaderTimeoutRef.current = setTimeout(clearLeader, SEQUENCE_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearLeader();
    };
  }, [navigate]);
}
