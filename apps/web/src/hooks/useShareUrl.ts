import { useCallback, useState } from "react";
import { flushPersistedAppState } from "../lib/persistAppState";

export function useShareUrl(getShareUrl: () => string | null) {
  const [shareCopied, setShareCopied] = useState(false);

  const handleCopyShare = useCallback(() => {
    flushPersistedAppState();
    const url = getShareUrl();
    if (url && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [getShareUrl]);

  return {
    shareCopied,
    handleCopyShare,
  };
}
