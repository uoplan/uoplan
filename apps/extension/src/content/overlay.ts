import browser from "webextension-polyfill";
import type { GradeBadge, GradesForCoursesResult, SectionRow } from "../shared/messages";
import { scanSections } from "./collect";

/**
 * uoPlan grade overlay. Scans PeopleSoft class-search/results/component rows for
 * course codes (via {@link scanSections}, mirroring apps/cli's selectors), asks
 * the background worker for the matching uoPlan grade aggregate, and injects a
 * compact badge (mean GPA + letter + A+%) next to each row. Runs in every frame,
 * idempotent, and re-applies after PeopleSoft reloads its target frame.
 */

const BADGE_CLASS = "uoplan-grade-badge";
const DONE_ATTR = "data-uoplan-grade";

function badgeText(code: string, b: GradeBadge): string {
  const parts = [code];
  if (b.letter) parts.push(b.letter);
  if (b.gpa !== null) parts.push(b.gpa.toFixed(2));
  if (b.aPlusPct !== null) parts.push(`${Math.round(b.aPlusPct)}% A+`);
  return parts.join(" · ");
}

function makeBadge(code: string, b: GradeBadge): HTMLElement {
  const el = document.createElement("span");
  el.className = BADGE_CLASS;
  el.textContent = badgeText(code, b);
  el.title = `uoPlan grades — ${code}: ${b.count} grades`;
  return el;
}

/** Element to attach the badge to for a given row (search rows only). */
function anchorFor(doc: Document, row: SectionRow): HTMLElement | null {
  if (row.kind === "search") {
    return doc.querySelector<HTMLElement>(`[id='MTG_CLASSNAME$${row.index}']`);
  }
  return null;
}

function rowsWithCodes(doc: Document): SectionRow[] {
  return scanSections(doc).filter((r) => r.courseCode);
}

async function fetchBadges(codes: string[]): Promise<Record<string, GradeBadge>> {
  try {
    const res = (await browser.runtime.sendMessage({
      type: "cmd",
      name: "grades-for-courses",
      codes,
    })) as GradesForCoursesResult | undefined;
    return res?.ok ? (res.byCode ?? {}) : {};
  } catch {
    return {};
  }
}

let scheduled = false;

/** Scan the frame, request grades, and inject badges. Idempotent per row. */
async function apply(doc: Document): Promise<void> {
  const rows = rowsWithCodes(doc);
  if (rows.length === 0) return;
  const codes = [...new Set(rows.map((r) => r.courseCode as string))];
  const byCode = await fetchBadges(codes);
  if (Object.keys(byCode).length === 0) return;

  for (const row of rows) {
    const code = row.courseCode as string;
    const badge = byCode[code];
    if (!badge) continue;
    const anchor = anchorFor(doc, row);
    if (!anchor || anchor.querySelector(`.${BADGE_CLASS}`)) continue;
    if (anchor.getAttribute(DONE_ATTR)) continue;
    anchor.setAttribute(DONE_ATTR, "1");
    anchor.append(makeBadge(code, badge));
  }
}

/** Debounced re-apply so PeopleSoft partial-page reloads keep their badges. */
function reapply(doc: Document): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void apply(doc);
  }, 400);
}

/** Start the overlay: initial pass + observe DOM mutations. */
export function startGradeOverlay(doc: Document): void {
  void apply(doc);
  const observer = new MutationObserver(() => reapply(doc));
  if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
}
