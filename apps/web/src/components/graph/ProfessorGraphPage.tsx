import { Link } from "@tanstack/react-router";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  Alert,
  Box,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch, IconExternalLink } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ProfessorGraphNode } from "@uoplan/core";
import { useTr, tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useProfessorGraphBuild } from "../../hooks/useProfessorGraphBuild";
import { getGraphNeighbors, type NeighborSortMode } from "../../lib/graph/professorGraphDetails";
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
import { BackButton } from "../shared/BackButton";

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
  useTr();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const professorRatings = useAppStore((s) => s.professorRatings);

  const { data: grades, error: gradesLoadError } = useCourseGradesPb();
  const { graphData, offeringsByProfessorId, buildProgress, buildError, isBuilding } =
    useProfessorGraphBuild(grades);
  const buildPhase: BuildPhase =
    gradesLoadError || buildError ? "error" : graphData ? "ready" : "loading";
  const loadError = gradesLoadError ?? buildError;
  const [layoutPhase, setLayoutPhase] = useState<ProfessorGraphPhase>("layout");
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [prevGraphData, setPrevGraphData] = useState(graphData);

  if (prevGraphData !== graphData && graphData) {
    setPrevGraphData(graphData);
    setLayoutPhase("layout");
    setLayoutProgress(0);
  }
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

  useEffect(() => {
    document.title = selectedNode ? `${selectedNode.displayName} — Prof network` : "Prof network";
    return () => {
      document.title = "Prof network";
    };
  }, [selectedNode]);

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

  const showDataLoadingOverlay = buildPhase === "loading" && !gradesLoadError;
  const showLayoutOverlay = buildPhase === "ready" && layoutPhase === "layout";
  const showOverlay = showDataLoadingOverlay || showLayoutOverlay;
  const overlayMessage = showDataLoadingOverlay
    ? isBuilding
      ? tr("graph.building")
      : tr("graph.loadingGrades")
    : tr("graph.layouting");
  const overlayProgress = Math.min(
    100,
    Math.max(0, showDataLoadingOverlay ? buildProgress : layoutProgress),
  );

  return (
    <Box
      component="main"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "var(--app-bg)",
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
              <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />
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
                  backgroundColor: "var(--app-surface-sunken)",
                  borderColor: "var(--app-border-strong)",
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
                  backgroundColor: "color-mix(in srgb, var(--app-surface) 96%, transparent)",
                  border: "var(--app-border-width) solid var(--app-border)",
                  borderRadius: "var(--app-radius)",
                  boxShadow: "var(--app-shadow)",
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
                        borderRadius: "var(--app-radius-sm)",
                        display: "block",
                        width: "100%",
                        backgroundColor:
                          previewNodeId === entry.id ? "var(--app-surface-hover)" : undefined,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text size="sm" c="var(--app-text)" lineClamp={1}>
                          {entry.displayName}
                        </Text>
                        {entry.legacyId != null && (
                          <Link
                            to="/explore/professor/$slug"
                            params={{ slug: String(entry.legacyId) }}
                            search={EMPTY_EXPLORE_SEARCH}
                            onClick={(e) => e.stopPropagation()}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={tr("explore.profileLink")}
                            title={tr("explore.profileLink")}
                            style={{
                              color: "var(--app-text)",
                              textDecoration: "none",
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <IconExternalLink size={15} stroke={1.8} />
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
          onLayoutProgress={setLayoutProgress}
          onNodeSelect={onNodeSelect}
        />
      )}

      {buildPhase === "error" && loadError && (
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
            {loadError}
          </Alert>
        </Box>
      )}

      {showOverlay && (
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
            backgroundColor: "color-mix(in srgb, var(--app-bg) 72%, transparent)",
            pointerEvents: "none",
            padding: 24,
          }}
        >
          <Stack gap="xs" align="center" w="100%" maw={320}>
            <Text c="dimmed" size="sm" ta="center">
              {overlayMessage}
            </Text>
            <Progress
              value={overlayProgress}
              size="sm"
              radius="xl"
              color="accentBlue"
              w="100%"
              transitionDuration={0}
              aria-label={overlayMessage}
              styles={{ root: { backgroundColor: "var(--app-border)" } }}
            />
            <Text size="xs" c="dimmed" ff="monospace">
              {overlayProgress}%
            </Text>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
