/**
 * OCR for modern course-evaluation charts. Modern reports do not expose the
 * Likert response options in their HTML — only the per-question statistics
 * (Registered / Responses / Average / Standard Deviation). The response option
 * *labels* are baked into the `ChartPic_*.png` bar chart, in a rigid layout:
 *
 *   A: almost always (4)  ████████ 50%
 *   B: often (3)          ██████ 38%
 *   ...
 *   [ Total (8) ]
 *
 * We OCR the chart to recover the ordinal option labels (best-first, A first).
 * Only the labels are kept — the per-option counts come from an unreliable OCR of
 * the bar values and are not stored; the authoritative per-question average comes
 * from the HTML statistics table. Results are cached next to the image so a
 * re-parse never re-runs OCR.
 *
 * This module is only used by the offline parse stage, so its `tesseract.js`
 * dependency never reaches the web/worker bundles or CI's proto build.
 */

import fs from "node:fs/promises";
import { createWorker, type Worker } from "tesseract.js";

// "A: almost always (4)" -> letter, label, count. The label is non-greedy up to
// the "(count)"; any bar-fill noise OCR'd after the count is ignored.
const OPTION_LINE = /^[A-Za-z]:\s*(.+?)\s*\(\d+\)/;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker("eng");
  return workerPromise;
}

/** Shut the OCR worker down once parsing is finished. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

function parseLabels(text: string): string[] {
  const labels: string[] = [];
  for (const rawLine of text.split("\n")) {
    const match = OPTION_LINE.exec(rawLine.trim());
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    if (label !== "") labels.push(label);
  }
  return labels;
}

/**
 * Ordinal response option labels for a chart image (in chart order, A first), or
 * an empty array when none could be recovered. Cached as `<image>.labels.json`.
 */
export async function extractChartLabels(imagePath: string): Promise<string[]> {
  const cachePath = `${imagePath}.labels.json`;
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf-8")) as string[];
  } catch {
    // Not cached yet; OCR below.
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(imagePath);
  const labels = parseLabels(data.text);
  await fs.writeFile(cachePath, JSON.stringify(labels));
  return labels;
}
