import { useAppStore } from "../appStore";

/**
 * Share / encoded-state surface: the pending shared (`?s=`) state plus the actions to
 * accept/dismiss it, build a share URL, get the base64 payload, or load decoded state.
 */
export function useShareState() {
  const pendingSharedState = useAppStore((s) => s.pendingSharedState);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const getEncodedStateBase64 = useAppStore((s) => s.getEncodedStateBase64);
  const loadEncodedState = useAppStore((s) => s.loadEncodedState);
  const acceptSharedState = useAppStore((s) => s.acceptSharedState);
  const dismissSharedState = useAppStore((s) => s.dismissSharedState);

  return {
    pendingSharedState,
    getShareUrl,
    getEncodedStateBase64,
    loadEncodedState,
    acceptSharedState,
    dismissSharedState,
  };
}

/** Just `getShareUrl` — for the copy-share affordance (see `hooks/useShareUrl`). */
export function useGetShareUrl() {
  return useAppStore((s) => s.getShareUrl);
}
