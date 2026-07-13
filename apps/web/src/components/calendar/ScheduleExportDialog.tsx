import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { tr, useTr } from "../../i18n";

export interface ScheduleExportDialogProps {
  opened: boolean;
  onClose: () => void;
  onExport: (options: { includeDeadlines: boolean }) => void | Promise<void>;
  /** Localized term or plan context supplied by the caller, e.g. "Winter 2026". */
  scopeLabel?: string;
}

export function ScheduleExportDialog({
  opened,
  onClose,
  onExport,
  scopeLabel,
}: ScheduleExportDialogProps) {
  useTr();

  const [includeDeadlines, setIncludeDeadlines] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // generationRef increments on every opened transition (true→false or false→true).
  // Each in-flight export captures its generation at dispatch; any post-await
  // continuation that finds a different value is stale and must be discarded.
  const generationRef = useRef(0);

  // mountedRef guards against post-unmount setState/onClose calls.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Synchronous state reset on session boundary — fires once per opened transition
  // (derived-state-from-props pattern; React re-renders exactly once more).
  const [lastSeen, setLastSeen] = useState(opened);
  if (lastSeen !== opened) {
    setLastSeen(opened);
    // Invalidate any in-flight continuation from the previous session.
    generationRef.current += 1;
    if (opened) {
      // Fresh open: clean slate.
      setIncludeDeadlines(false);
      setError(null);
      setPending(false);
    }
  }

  function handleClose() {
    if (pending) return;
    setError(null);
    setIncludeDeadlines(false);
    onClose();
  }

  function handleExport() {
    if (pending) return;
    setPending(true);
    setError(null);

    // Capture the current session token; anything that resolves after a
    // session boundary (close/reopen) or unmount will see a different value
    // and silently discard its effects.
    const myGeneration = generationRef.current;
    const isCurrentSession = () => mountedRef.current && generationRef.current === myGeneration;

    const run = async () => {
      try {
        await onExport({ includeDeadlines });
        if (!isCurrentSession()) return;
        setPending(false);
        setError(null);
        onClose();
      } catch (err: unknown) {
        if (!isCurrentSession()) return;
        setPending(false);
        const msg = err instanceof Error && err.message ? err.message : tr("scheduleExport.error");
        setError(msg);
      }
    };

    void run();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={tr("scheduleExport.title")}
      centered
      size="sm"
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
    >
      <Stack gap="md">
        {scopeLabel ? (
          <Text size="sm" c="var(--app-text-muted)">
            {scopeLabel}
          </Text>
        ) : null}

        <Text size="sm">{tr("scheduleExport.description")}</Text>

        <Checkbox
          checked={includeDeadlines}
          onChange={(e) => setIncludeDeadlines(e.currentTarget.checked)}
          label={tr("scheduleExport.includeDeadlines")}
          disabled={pending}
        />

        {error ? (
          <Text size="sm" c="red" role="alert">
            {error}
          </Text>
        ) : null}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={pending}>
            {tr("scheduleExport.cancel")}
          </Button>
          <Button onClick={handleExport} loading={pending} disabled={pending}>
            {pending ? tr("scheduleExport.downloading") : tr("scheduleExport.download")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
