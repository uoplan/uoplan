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
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buildProfessorCoTeachingGraph, type ProfessorGraphNode } from "schedule";
import { tr } from "../../i18n";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildOfferingsByProfessorId,
  getGraphNeighbors,
  type NeighborSortMode,
} from "../../lib/graph/professorGraphDetails";
import {
  parseProfessorSearchParam,
  professorToSearchParam,
} from "../../lib/graph/graphSearchParams";
import {
  buildProfessorSearchEntries,
  searchProfessors,
  type ProfessorSearchEntry,
} from "../../lib/graph/professorGraphSearch";
import { useAppStore } from "../../store/appStore";
import { ProfessorGraphDesktopPanel } from "./ProfessorGraphDesktopPanel";
import { ProfessorGraphMobileDrawer } from "./ProfessorGraphMobileDrawer";
import { ProfessorGraphView, type ProfessorGraphPhase } from "./ProfessorGraphView";

type BuildPhase = "loading" | "ready" | "error";

export type ProfessorGraphNavigate = (opts: {
  search: { prof: string | undefined };
  replace?: boolean;
}) => void | Promise<void>;

export function ProfessorGraphPage({
  urlProfParam,
  navigateGraph,
}: {
  urlProfParam?: string;
  navigateGraph: ProfessorGraphNavigate;
}) {
  useLingui();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const professorRatings = useAppStore((s) => s.professorRatings);

  const { loading, data: grades, error } = useCourseGradesPb();
  const graphData = useMemo(
    () => (grades ? buildProfessorCoTeachingGraph(grades) : null),
    [grades],
  );
  const offeringsByProfessorId = useMemo(
    () => (grades ? buildOfferingsByProfessorId(grades) : new Map<string, ExploreOfferingFlat[]>()),
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
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [neighborSort, setNeighborSort] = useState<NeighborSortMode>("strength");
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

  const urlNodeId = useMemo(
    () =>
      graphData && buildPhase === "ready"
        ? parseProfessorSearchParam(urlProfParam, nodesById)
        : null,
    [urlProfParam, nodesById, graphData, buildPhase],
  );

  const selectedNode = useMemo(() => {
    if (!urlNodeId) return null;
    return nodesById.get(urlNodeId) ?? null;
  }, [urlNodeId, nodesById]);

  const focusNodeId = selectedNode?.id ?? previewNodeId;

  const selectedOfferings = useMemo(() => {
    if (!selectedNode) return [];
    return offeringsByProfessorId.get(selectedNode.id) ?? [];
  }, [selectedNode, offeringsByProfessorId]);

  const selectedNeighbors = useMemo(() => {
    if (!graphData || !selectedNode) return [];
    return getGraphNeighbors(graphData, selectedNode.id, nodesById);
  }, [graphData, selectedNode, nodesById]);

  const setPreviewThrottled = useCallback((nodeId: string | null) => {
    if (previewRafRef.current != null) cancelAnimationFrame(previewRafRef.current);
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      setPreviewNodeId(nodeId);
    });
  }, []);

  const onNodeSelect = useCallback(
    (node: ProfessorGraphNode | null) => {
      setPreviewNodeId(null);
      void navigateGraph({
        search: { prof: node ? professorToSearchParam(node) : undefined },
      });
    },
    [navigateGraph],
  );

  const onPickProfessor = useCallback(
    (entry: ProfessorSearchEntry) => {
      setSearch(entry.displayName);
      onNodeSelect(nodesById.get(entry.id) ?? null);
    },
    [nodesById, onNodeSelect],
  );

  useEffect(() => {
    if (!graphData || buildPhase !== "ready") return;
    if (!urlProfParam) return;
    if (urlNodeId) return;
    void navigateGraph({ search: { prof: undefined }, replace: true });
  }, [urlProfParam, urlNodeId, graphData, buildPhase, navigateGraph]);

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

      {isMobile ? (
        <ProfessorGraphMobileDrawer
          node={selectedNode}
          offerings={selectedOfferings}
          neighbors={selectedNeighbors}
          neighborSort={neighborSort}
          onNeighborSortChange={setNeighborSort}
          offeringsByProfessorId={offeringsByProfessorId}
          professorRatings={professorRatings}
          onSelectNode={onNodeSelect}
          onClose={() => onNodeSelect(null)}
        />
      ) : (
        selectedNode && (
          <ProfessorGraphDesktopPanel
            node={selectedNode}
            offerings={selectedOfferings}
            neighbors={selectedNeighbors}
            neighborSort={neighborSort}
            onNeighborSortChange={setNeighborSort}
            offeringsByProfessorId={offeringsByProfessorId}
            professorRatings={professorRatings}
            onSelectNode={onNodeSelect}
            onClose={() => onNodeSelect(null)}
          />
        )
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
