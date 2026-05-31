import { useState } from "react";
import { Alert, Button, List, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { useAppStore, useAppStoreApi } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import {
  parseUEnrollUrl,
  resolveUEnrollSchedule,
  type ParsedUEnrollData,
  type UEnrollResolveResult,
} from "../../lib/importFromUEnroll";
import { tr } from "../../i18n";

interface UEnrollImportModalProps {
  opened: boolean;
  onClose: () => void;
}

type ParseState =
  | { status: "idle" }
  | { status: "parsed"; parsed: ParsedUEnrollData; resolved: UEnrollResolveResult }
  | { status: "parse-error" };

export function UEnrollImportModal({ opened, onClose }: UEnrollImportModalProps) {
  useLingui();

  const { cache, terms, selectedTermId, setSelectedTermId, importSchedule } = useAppStore(
    useShallow((s) => ({
      cache: s.cache,
      terms: s.terms,
      selectedTermId: s.selectedTermId,
      setSelectedTermId: s.setSelectedTermId,
      importSchedule: s.importSchedule,
    })),
  );
  const storeApi = useAppStoreApi();

  const [input, setInput] = useState("");
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });
  const [importing, setImporting] = useState(false);

  function handleChange(value: string) {
    setInput(value);
    if (!value.trim() || !cache) {
      setParseState({ status: "idle" });
      return;
    }
    try {
      const parsed = parseUEnrollUrl(value);
      const resolved = resolveUEnrollSchedule(parsed.courses, cache);
      setParseState({ status: "parsed", parsed, resolved });
    } catch {
      setParseState({ status: "parse-error" });
    }
  }

  async function handleImport() {
    if (parseState.status !== "parsed") return;
    setImporting(true);
    try {
      const { parsed } = parseState;
      let activeCache = cache;

      if (parsed.termId && parsed.termId !== selectedTermId) {
        await setSelectedTermId(parsed.termId);
        activeCache = storeApi.getState().cache;
      }

      if (!activeCache) return;

      const resolved = resolveUEnrollSchedule(parsed.courses, activeCache);
      if (!resolved.ok) return;

      importSchedule(resolved.schedule);
      setInput("");
      setParseState({ status: "idle" });
      onClose();
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setInput("");
    setParseState({ status: "idle" });
    onClose();
  }

  const termMismatch =
    parseState.status === "parsed" &&
    parseState.parsed.termId !== null &&
    parseState.parsed.termId !== selectedTermId;

  const targetTermName =
    termMismatch && parseState.status === "parsed"
      ? (terms?.find((t) => t.termId === parseState.parsed.termId)?.name ??
        parseState.parsed.termId)
      : null;

  const canImport = parseState.status === "parsed" && (parseState.resolved.ok || termMismatch);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={tr("uenrollImport.modal.title")}
      size="md"
      centered
      radius="md"
    >
      <Stack gap="md">
        <TextInput
          label={tr("uenrollImport.modal.inputLabel")}
          placeholder={tr("uenrollImport.modal.inputPlaceholder")}
          value={input}
          onChange={(e) => handleChange(e.currentTarget.value)}
          radius="md"
        />

        {parseState.status === "parsed" && (
          <Stack gap="xs">
            {termMismatch && targetTermName && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md">
                <Text size="sm">
                  {tr("uenrollImport.modal.termSwitch", { term: targetTermName })}
                </Text>
              </Alert>
            )}

            {parseState.resolved.ok && (
              <Alert
                icon={<IconCircleCheck size={16} />}
                color="teal"
                title={tr("uenrollImport.modal.recognized")}
                radius="md"
              >
                <List size="sm" spacing={2}>
                  {parseState.resolved.schedule.enrollments.map((e) => (
                    <List.Item key={e.courseCode}>{e.courseCode}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            {parseState.resolved.ok && parseState.resolved.warnings.length > 0 && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                title={tr("uenrollImport.modal.warnings")}
                radius="md"
              >
                <List size="sm" spacing={2}>
                  {parseState.resolved.warnings.map((w) => (
                    <List.Item key={w}>{w}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            {!parseState.resolved.ok && !termMismatch && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                title={tr("uenrollImport.modal.noCoursesTitle")}
                radius="md"
              >
                <Text size="sm">{tr("uenrollImport.modal.noCoursesDescription")}</Text>
              </Alert>
            )}
          </Stack>
        )}

        {parseState.status === "parse-error" && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title={tr("uenrollImport.modal.invalid")}
            radius="md"
          >
            <Text size="sm">{tr("uenrollImport.modal.invalidDescription")}</Text>
          </Alert>
        )}

        <Button
          color="accentBlue"
          radius="md"
          disabled={!canImport}
          loading={importing}
          onClick={() => void handleImport()}
          fullWidth
        >
          {tr("uenrollImport.modal.confirm")}
        </Button>
      </Stack>
    </Modal>
  );
}
