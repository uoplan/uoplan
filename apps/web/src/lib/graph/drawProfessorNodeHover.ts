import type { Settings } from "sigma/settings";

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

/** Dark tooltip for hovered professor nodes (replaces Sigma's white hover pill). */
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

  context.fillStyle = "rgba(26, 27, 30, 0.96)";
  context.strokeStyle = "rgba(134, 142, 150, 0.35)";
  context.lineWidth = 1;
  roundRect(context, x, y, boxW, boxH, 6);
  context.fill();
  context.stroke();

  context.fillStyle = "#F8F9FA";
  context.fillText(data.label, x + padX, y + padY + size * 0.8);
}
