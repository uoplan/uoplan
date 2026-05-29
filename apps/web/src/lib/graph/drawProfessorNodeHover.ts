import type { Settings } from "sigma/settings";

function themeColor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/** Theme-aware tooltip for hovered professor nodes (replaces Sigma's white hover pill). */
export function drawProfessorNodeHover(
  context: CanvasRenderingContext2D,
  data: { label?: string | null; x: number; y: number; size: number },
  settings: Settings,
): void {
  if (!data.label) return;

  const size = settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  context.font = `${weight} ${size}px ${font}`;

  const textWidth = context.measureText(data.label).width;
  const padX = 8;
  const padY = 5;
  const boxW = textWidth + padX * 2;
  const boxH = size + padY * 2;
  const x = data.x - boxW / 2;
  const y = data.y - data.size - boxH - 8;

  context.fillStyle = themeColor("--app-surface-overlay");
  context.strokeStyle = themeColor("--app-border");
  context.lineWidth = 1;
  context.beginPath();
  context.rect(x, y, boxW, boxH);
  context.fill();
  context.stroke();

  context.fillStyle = themeColor("--app-text");
  context.fillText(data.label, x + padX, y + padY + size * 0.8);
}
