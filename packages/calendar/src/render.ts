import { getCourseColorHex, hexToRgb, formatTimeRange24 } from "@uoplan/core";
import type { CalendarEvent } from "./types";
import { assignLanes, CAL_START_MINUTES, CAL_END_MINUTES, WEEKDAY_CODES } from "./layout";

const BG = "#111113";
const GRID_LINE = "#2c2e33";
const GRID_HALF = "rgba(44,46,51,0.45)";
const TEXT_WHITE = "#ffffff";
const TEXT_TIME = "rgba(255,255,255,0.85)";
const TEXT_PROF = "rgba(255,255,255,0.78)";
const LEFT_BORDER_W = 6;
const GRADE_BAR_H = 6;
const PAD_LEFT = 7;
const PAD_TOP = 6;
const PAD_BOTTOM = 6;

const FONT = "DM Mono,monospace";
const FONT_MEDIUM = "DM Mono Medium,monospace";

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

function componentKindOnly(componentSection: string): string {
  const i = componentSection.indexOf(" - ");
  return (i >= 0 ? componentSection.slice(0, i) : componentSection).trim();
}

function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return formatTimeRange24(startMinutes, endMinutes, "–");
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

  const colW = W / days.length;
  const spanMinutes = CAL_END_MINUTES - CAL_START_MINUTES;

  function minutesToY(m: number): number {
    return ((m - CAL_START_MINUTES) / spanMinutes) * H;
  }

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );

  // Background
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  // Hour and half-hour grid lines
  let t = CAL_START_MINUTES;
  while (t <= CAL_END_MINUTES) {
    const y = minutesToY(t);
    const isHour = t % 60 === 0;
    parts.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${isHour ? GRID_LINE : GRID_HALF}" stroke-width="1"/>`,
    );
    t += 30;
  }

  // Vertical column separators
  for (let i = 1; i < days.length; i++) {
    const x = i * colW;
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID_LINE}" stroke-width="1"/>`,
    );
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

      const laneW = colW / laneCount;
      const x = dayIdx * colW + laneIndex * laneW;
      const y = minutesToY(event.startMinutes);
      const eventH = minutesToY(event.endMinutes) - y;

      if (eventH < 4) continue;

      // Background fill
      parts.push(
        `<rect x="${x}" y="${y}" width="${laneW}" height="${eventH}" fill="rgba(${r},${g},${b},0.38)"/>`,
      );

      // Left accent border
      parts.push(
        `<rect x="${x}" y="${y}" width="${LEFT_BORDER_W}" height="${eventH}" fill="${hex}"/>`,
      );

      // Grade strip — starts after the left border, sits flush at the bottom
      const gradeViz = event.gradeViz;
      const hasGrade = gradeViz && gradeViz.total > 0 && eventH >= GRADE_BAR_H + 8;
      if (hasGrade) {
        const stripY = y + eventH - GRADE_BAR_H;
        const stripX = x + LEFT_BORDER_W;
        const stripW = laneW - LEFT_BORDER_W;
        let bucketX = stripX;
        for (const bucket of gradeViz.buckets) {
          if (bucket.count <= 0) continue;
          const bucketW = (bucket.count / gradeViz.total) * stripW;
          parts.push(
            `<rect x="${bucketX}" y="${stripY}" width="${bucketW}" height="${GRADE_BAR_H}" fill="${e(bucket.color)}"/>`,
          );
          bucketX += bucketW;
        }
      }

      // Text layout
      const textX = x + LEFT_BORDER_W + PAD_LEFT;
      const textAreaBottom = y + eventH - (hasGrade ? GRADE_BAR_H : 0) - PAD_BOTTOM;

      // Course code — top
      const codeSize = 16;
      const codeY = y + PAD_TOP + codeSize;
      if (codeY <= textAreaBottom && eventH >= codeSize + PAD_TOP + 4) {
        parts.push(
          `<text x="${textX}" y="${codeY}" font-family="${FONT_MEDIUM}" font-size="${codeSize}" fill="${TEXT_WHITE}">${e(event.courseCode)}</text>`,
        );
      }

      // Component + time — second line
      const metaSize = 13;
      const metaY = codeY + metaSize + 4;
      const comp = componentKindOnly(event.componentSection);
      const timeRange = formatTimeRange(event.startMinutes, event.endMinutes);
      if (metaY <= textAreaBottom && eventH >= codeSize + metaSize + PAD_TOP + 10) {
        parts.push(
          `<text x="${textX}" y="${metaY}" font-family="${FONT_MEDIUM}" font-size="${metaSize}" fill="${TEXT_WHITE}">${e(comp)}</text>`,
        );
        const compApproxW = comp.length * metaSize * 0.58;
        const sepX = textX + compApproxW + 4;
        parts.push(
          `<text x="${sepX}" y="${metaY}" font-family="${FONT}" font-size="${metaSize}" fill="rgba(255,255,255,0.35)">·</text>`,
        );
        parts.push(
          `<text x="${sepX + 11}" y="${metaY}" font-family="${FONT}" font-size="${metaSize}" fill="${TEXT_TIME}">${e(timeRange)}</text>`,
        );
      }

      // Professor — pinned to bottom of text area, only if there's enough room
      const profName = event.professor && event.professor !== "—" ? event.professor : null;
      const profSize = 12;
      const profY = textAreaBottom - 2;
      if (profName && profY >= metaY + profSize + 8) {
        parts.push(
          `<text x="${textX}" y="${profY}" font-family="${FONT_MEDIUM}" font-size="${profSize}" fill="${TEXT_PROF}">${e(profName)}</text>`,
        );
      }
    }
  }

  parts.push(`</svg>`);

  return parts.join("\n");
}
