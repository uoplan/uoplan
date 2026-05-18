import type { CameraState } from "sigma/types";
import type Sigma from "sigma";
import { getCorrectionRatio } from "sigma/utils";

/** Sigma instance with any node/edge attrs (camera fit only reads positions). */
type SigmaInstance = Sigma<Record<string, unknown>, Record<string, unknown>>;

/** Max zoom-in when framing a selection (lower ratio = closer). */
const FOCUS_MAX_ZOOM_RATIO = 0.16;

type FitOptions = {
  /** Extra margin around the cluster (0.15 ≈ 15% per side). */
  padding?: number;
};

/**
 * Camera state that frames the given nodes with padding, adapted from @sigma/utils.
 * Call after sigma.refresh() so node display positions are current.
 */
function getCameraStateToFitViewportToNodes(
  sigma: SigmaInstance,
  nodes: string[],
  options: FitOptions = {},
): CameraState {
  if (nodes.length === 0)
    throw new Error("getCameraStateToFitViewportToNodes: need at least one node.");

  const padding = options.padding ?? 0.15;
  const graph = sigma.getGraph();

  let groupMinX = Infinity;
  let groupMaxX = -Infinity;
  let groupMinY = Infinity;
  let groupMaxY = -Infinity;
  let groupFramedMinX = Infinity;
  let groupFramedMaxX = -Infinity;
  let groupFramedMinY = Infinity;
  let groupFramedMaxY = -Infinity;

  for (const node of nodes) {
    const data = sigma.getNodeDisplayData(node);
    if (!data) continue;

    const { x, y } = graph.getNodeAttributes(node) as { x: number; y: number };
    const framedX = data.x;
    const framedY = data.y;

    groupMinX = Math.min(groupMinX, x);
    groupMaxX = Math.max(groupMaxX, x);
    groupMinY = Math.min(groupMinY, y);
    groupMaxY = Math.max(groupMaxY, y);
    groupFramedMinX = Math.min(groupFramedMinX, framedX);
    groupFramedMaxX = Math.max(groupFramedMaxX, framedX);
    groupFramedMinY = Math.min(groupFramedMinY, framedY);
    groupFramedMaxY = Math.max(groupFramedMaxY, framedY);
  }

  const bbox = sigma.getCustomBBox() || sigma.getBBox();
  const graphWidth = bbox.x[1] - bbox.x[0] || 1;
  const graphHeight = bbox.y[1] - bbox.y[0] || 1;

  const groupCenterX = (groupFramedMinX + groupFramedMaxX) / 2;
  const groupCenterY = (groupFramedMinY + groupFramedMaxY) / 2;

  let groupWidth = (groupMaxX - groupMinX) * (1 + padding * 2) || graphWidth * 0.05;
  let groupHeight = (groupMaxY - groupMinY) * (1 + padding * 2) || graphHeight * 0.05;

  const minSpan = Math.max(graphWidth, graphHeight) * 0.025;
  groupWidth = Math.max(groupWidth, minSpan);
  groupHeight = Math.max(groupHeight, minSpan);

  const { width, height } = sigma.getDimensions();
  const correction = getCorrectionRatio(
    { width, height },
    { width: graphWidth, height: graphHeight },
  );
  const fitRatio =
    ((groupHeight / groupWidth < height / width ? groupWidth : groupHeight) /
      Math.max(graphWidth, graphHeight)) *
    correction;

  const minRatio = sigma.getSetting("minCameraRatio") ?? 0.02;
  const ratio = Math.max(minRatio, Math.max(fitRatio, FOCUS_MAX_ZOOM_RATIO));

  return {
    ...sigma.getCamera().getState(),
    angle: 0,
    x: groupCenterX,
    y: groupCenterY,
    ratio,
  };
}

export function animateCameraToHighlightedNodes(
  sigma: SigmaInstance,
  nodeId: string,
  neighborIds: Iterable<string>,
): void {
  const nodes = [nodeId, ...neighborIds];
  const state = getCameraStateToFitViewportToNodes(sigma, nodes);
  void sigma.getCamera().animate(state, { duration: 350 });
}
