import { getCourseColorHex, hexToRgb } from "@uoplan/schedule";
import type { CalendarEvent } from "./types";
import {
  assignLanes,
  CAL_START_MINUTES,
  CAL_END_MINUTES,
  WEEKDAY_CODES,
  DAY_LABELS,
} from "./layout";

const BG = "#111113";
const GRID_LINE = "#2c2e33";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#909296";
const TIME_AXIS_W = 52;
const HEADER_H = 36;
const HOUR_LABEL_INTERVAL = 60; // every hour

interface RenderOptions {
  width?: number;
  height?: number;
}

function e(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderCalendarToSvg(
  events: CalendarEvent[],
  colorMap: Record<string, number>,
  options: RenderOptions = {},
): string {
  const W = options.width ?? 1200;
  const H = options.height ?? 630;

  const activeDays = WEEKDAY_CODES.filter((d) => events.some((ev) => ev.day === d));
  const days = activeDays.length > 0 ? activeDays : WEEKDAY_CODES;

  const gridW = W - TIME_AXIS_W;
  const gridH = H - HEADER_H;
  const colW = gridW / days.length;

  const spanMinutes = CAL_END_MINUTES - CAL_START_MINUTES;

  function minutesToY(m: number): number {
    return HEADER_H + ((m - CAL_START_MINUTES) / spanMinutes) * gridH;
  }

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );

  // Background
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  // Header background
  parts.push(`<rect width="${W}" height="${HEADER_H}" fill="${GRID_LINE}"/>`);

  // Day column headers
  for (let i = 0; i < days.length; i++) {
    const cx = TIME_AXIS_W + i * colW + colW / 2;
    parts.push(
      `<text x="${cx}" y="${HEADER_H / 2 + 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${TEXT_PRIMARY}">${e(DAY_LABELS[days[i]])}</text>`,
    );
  }

  // Vertical separators between days
  for (let i = 1; i < days.length; i++) {
    const x = TIME_AXIS_W + i * colW;
    parts.push(
      `<line x1="${x}" y1="${HEADER_H}" x2="${x}" y2="${H}" stroke="${GRID_LINE}" stroke-width="1"/>`,
    );
  }

  // Hour grid lines and time labels
  let t = CAL_START_MINUTES;
  while (t <= CAL_END_MINUTES) {
    const y = minutesToY(t);
    const h = Math.floor(t / 60);
    const label = `${String(h).padStart(2, "0")}:00`;
    parts.push(
      `<line x1="${TIME_AXIS_W}" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID_LINE}" stroke-width="1"/>`,
    );
    if (t < CAL_END_MINUTES) {
      parts.push(
        `<text x="${TIME_AXIS_W - 6}" y="${y + 4}" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" fill="${TEXT_MUTED}">${e(label)}</text>`,
      );
    }
    t += HOUR_LABEL_INTERVAL;
  }

  // Events
  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    const dayEvents = events.filter((ev) => ev.day === day);
    const laidOut = assignLanes(dayEvents);

    for (const { event, laneIndex, laneCount } of laidOut) {
      const colorIdx = colorMap[event.courseCode] ?? 0;
      const hex = getCourseColorHex(colorIdx);
      const { r, g, b } = hexToRgb(hex);

      const x = TIME_AXIS_W + dayIdx * colW + (laneIndex / laneCount) * colW + 2;
      const laneW = colW / laneCount - 4;
      const y = minutesToY(event.startMinutes) + 1;
      const eventH = minutesToY(event.endMinutes) - y - 1;

      if (eventH < 4) continue;

      // Event block
      parts.push(
        `<rect x="${x}" y="${y}" width="${laneW}" height="${eventH}" rx="4" fill="rgba(${r},${g},${b},0.55)" stroke="${hex}" stroke-width="1.5"/>`,
      );

      // Course code label
      const fontSize = Math.min(13, Math.max(9, eventH / 3.5));
      if (eventH >= 16) {
        const labelY = y + Math.min(16, eventH / 2 + 6);
        parts.push(
          `<text x="${x + laneW / 2}" y="${labelY}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="${TEXT_PRIMARY}">${e(event.courseCode)}</text>`,
        );
      }

      // Section label (if enough space)
      if (eventH >= 34) {
        parts.push(
          `<text x="${x + laneW / 2}" y="${y + Math.min(28, eventH - 6)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.max(8, fontSize - 2)}" fill="rgba(255,255,255,0.75)">${e(event.componentSection)}</text>`,
        );
      }
    }
  }

  // Time axis separator
  parts.push(
    `<line x1="${TIME_AXIS_W}" y1="${HEADER_H}" x2="${TIME_AXIS_W}" y2="${H}" stroke="${GRID_LINE}" stroke-width="1"/>`,
  );

  parts.push(`</svg>`);

  return parts.join("\n");
}
