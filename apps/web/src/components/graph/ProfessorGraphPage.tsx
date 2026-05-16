import { Link } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { IconSearch } from "@tabler/icons-react";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { buildProfessorCoTeachingGraph, type ProfessorGraphNode } from "schedule";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildProfessorSearchEntries,
  searchProfessors,
  type ProfessorSearchEntry,
} from "../../lib/graph/professorGraphSearch";
import { ProfessorGraphView, type ProfessorGraphPhase } from "./ProfessorGraphView";

type BuildPhase = "loading" | "ready" | "error";

export function ProfessorGraphPage() {
  useLingui();

  const { loading, data: grades, error } = useCourseGradesPb();
  const graphData = useMemo(
    () => (grades ? buildProfessorCoTeachingGraph(grades) : null),
    [grades],
  );
  const buildPhase: BuildPhase = loading
    ? "loading"
    : error
      ? "error"
      : graphData
        ? "ready"
        : "loading";
  const [layoutPhase, setLayoutPhase] = useState<ProfessorGraphPhase>("layout");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ProfessorGraphNode | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 150);
  const [, startSearchTransition] = useTransition();
  const previewRafRef = useRef<number | null>(null);

  const nodesById = useMemo(() => {
    if (!graphData) return new Map<string, ProfessorGraphNode>();
    return new Map(graphData.nodes.map((n) => [n.id, n]));
  }, [graphData]);

  const searchEntries = useMemo(
    () => (graphData ? buildProfessorSearchEntries(graphData.nodes) : []),
    [graphData],
  );

  const searchResults = useMemo(
    () => searchProfessors(searchEntries, debouncedSearch),
    [searchEntries, debouncedSearch],
  );

  const setPreviewThrottled = useCallback((nodeId: string | null) => {
    if (previewRafRef.current != null) cancelAnimationFrame(previewRafRef.current);
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      setPreviewNodeId(nodeId);
    });
  }, []);

  const onNodeSelect = useCallback((node: ProfessorGraphNode | null) => {
    setPreviewNodeId(null);
    setSelectedNode(node);
    setFocusNodeId(node?.id ?? null);
  }, []);

  const onPickProfessor = useCallback(
    (entry: ProfessorSearchEntry) => {
      setSearch(entry.displayName);
      setPreviewNodeId(null);
      setFocusNodeId(entry.id);
      setSelectedNode(nodesById.get(entry.id) ?? null);
    },
    [nodesById],
  );

  const showOverlay = buildPhase !== "ready" || layoutPhase === "layout";
  const overlayMessage =
    buildPhase === "loading" ? tr("graph.loadingGrades") : tr("graph.layouting");

  return (
    <Box
      component="main"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#141517",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: 16,
          pointerEvents: "none",
        }}
      >
        <Group align="flex-start" justify="space-between" wrap="nowrap" gap="md">
          <Stack gap="xs" style={{ pointerEvents: "auto", maxWidth: 360, width: "100%" }}>
            <Group gap="xs" wrap="nowrap">
              <Link to="/step/term" style={{ textDecoration: "none" }}>
                <Button variant="subtle" color="gray" size="xs">
                  {tr("app.nav.back")}
                </Button>
              </Link>
              <Text size="sm" c="dimmed" fw={600}>
                {tr("graph.title")}
              </Text>
            </Group>

            <TextInput
              placeholder={tr("graph.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                const next = e.currentTarget.value;
                startSearchTransition(() => setSearch(next));
              }}
              leftSection={<IconSearch size={16} stroke={1.6} />}
              styles={{
                input: {
                  backgroundColor: "rgba(20, 21, 23, 0.92)",
                  borderColor: "rgba(134, 142, 150, 0.35)",
                },
              }}
              disabled={!graphData}
            />

            {debouncedSearch.trim().length > 0 && searchResults.length > 0 && (
              <Paper
                shadow="md"
                p={4}
                onMouseLeave={() => setPreviewThrottled(null)}
                style={{
                  backgroundColor: "rgba(26, 27, 30, 0.96)",
                  border: "1px solid rgba(134, 142, 150, 0.25)",
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                <Stack gap={0}>
                  {searchResults.map((entry) => (
                    <UnstyledButton
                      key={entry.id}
                      onMouseEnter={() => setPreviewThrottled(entry.id)}
                      onClick={() => onPickProfessor(entry)}
                      px="sm"
                      py={8}
                      style={{
                        borderRadius: 6,
                        display: "block",
                        width: "100%",
                        backgroundColor:
                          previewNodeId === entry.id ? "rgba(151, 117, 250, 0.12)" : undefined,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text size="sm" c="#F8F9FA" lineClamp={1}>
                          {entry.displayName}
                        </Text>
                        {entry.legacyId != null && (
                          <Link
                            to="/explore/professor/$legacyId"
                            params={{ legacyId: String(entry.legacyId) }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: "var(--mantine-font-size-xs)",
                              color: "var(--mantine-color-violet-4)",
                              textDecoration: "none",
                              flexShrink: 0,
                            }}
                          >
                            {tr("explore.profileLink")}
                          </Link>
                        )}
                      </Group>
                    </UnstyledButton>
                  ))}
                </Stack>
              </Paper>
            )}

            {debouncedSearch.trim().length > 0 && searchResults.length === 0 && graphData && (
              <Text size="xs" c="dimmed">
                {tr("graph.noResults")}
              </Text>
            )}
          </Stack>
        </Group>
      </Box>

      {selectedNode && (
        <Paper
          shadow="md"
          p="md"
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            zIndex: 20,
            maxWidth: 320,
            backgroundColor: "rgba(26, 27, 30, 0.94)",
            border: "1px solid rgba(134, 142, 150, 0.25)",
            pointerEvents: "auto",
          }}
        >
          <Stack gap={4}>
            <Text fw={600} c="#F8F9FA" size="sm">
              {selectedNode.displayName}
            </Text>
            <Text size="xs" c="dimmed">
              {tr("graph.connections", { count: selectedNode.degree })}
            </Text>
            {selectedNode.degree === 0 && (
              <Text size="xs" c="dimmed">
                {tr("graph.noConnections")}
              </Text>
            )}
            {selectedNode.subjects.length > 0 && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {selectedNode.subjects.join(", ")}
              </Text>
            )}
            {selectedNode.legacyId != null && (
              <Link
                to="/explore/professor/$legacyId"
                params={{ legacyId: String(selectedNode.legacyId) }}
                style={{
                  fontSize: "var(--mantine-font-size-xs)",
                  color: "var(--mantine-color-violet-4)",
                  textDecoration: "none",
                }}
              >
                {tr("explore.profileLink")}
              </Link>
            )}
          </Stack>
        </Paper>
      )}

      {graphData && buildPhase === "ready" && (
        <ProfessorGraphView
          data={graphData}
          focusNodeId={focusNodeId}
          previewNodeId={previewNodeId}
          onPhaseChange={setLayoutPhase}
          onNodeSelect={onNodeSelect}
        />
      )}

      {buildPhase === "error" && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Alert color="red" title={tr("graph.loadErrorTitle")}>
            {error}
          </Alert>
        </Box>
      )}

      {showOverlay && buildPhase !== "error" && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            zIndex: 15,
            backgroundColor: "rgba(20, 21, 23, 0.72)",
            pointerEvents: "none",
          }}
        >
          <Loader color="violet" size="md" />
          <Text c="dimmed" size="sm">
            {overlayMessage}
          </Text>
        </Box>
      )}
    </Box>
  );
}
