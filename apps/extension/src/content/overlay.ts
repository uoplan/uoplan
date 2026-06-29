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
const PILL_ID = "uoplan-status-pill";

/** Always-visible proof the overlay is alive in the top frame; updates with status. */
function setPill(doc: Document, text: string): void {
  if (doc.defaultView !== doc.defaultView?.top) return; // top frame only
  let pill = doc.getElementById(PILL_ID);
  if (!pill) {
    pill = doc.createElement("div");
    pill.id = PILL_ID;
    doc.body?.append(pill);
  }
  pill.textContent = `uoPlan · ${text}`;
}

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

/** Element to attach the badge to for a given row (those with an anchor id). */
function anchorFor(doc: Document, row: SectionRow): HTMLElement | null {
  return row.anchorId ? doc.getElementById(row.anchorId) : null;
}

function rowsWithCodes(doc: Document): SectionRow[] {
  const out: SectionRow[] = [];
  const seen = new Set<string>();
  for (const r of scanSections(doc)) {
    if (!r.courseCode) continue;
    const key = `${r.kind}:${r.courseCode}:${r.classNbr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
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
let lastSig = "";

/**
 * Scan the frame, request grades, and inject badges. Idempotent per row.
 * `log` reports diagnostics to the sink so progress is visible while debugging.
 */
async function apply(doc: Document, log?: (m: string) => void): Promise<void> {
  const rows = rowsWithCodes(doc);
  if (rows.length === 0) {
    // Probe: surface candidate course-row ids so we can fix selectors remotely.
    const ids = [...doc.querySelectorAll<HTMLElement>("[id]")]
      .map((el) => el.id)
      .filter((id) => /CLASS|CRSE|REGFORM|MTG|SUBJECT|P_/i.test(id))
      .slice(0, 25);
    setPill(doc, "active · no courses here");
    log?.(`overlay: 0 rows (probe ids: ${ids.join(", ") || "none"})`);
    return;
  }
  const codes = [...new Set(rows.map((r) => r.courseCode as string))];
  const byCode = await fetchBadges(codes);
  const matched = Object.keys(byCode).length;
  setPill(doc, `${rows.length} courses · ${matched} graded`);
  log?.(
    `overlay: ${rows.length} rows, ${codes.length} codes [${codes.slice(0, 8).join(",")}] → ${matched} matched`,
  );
  if (matched === 0) return;

  let injected = 0;
  const detail: string[] = [];
  for (const row of rows) {
    const code = row.courseCode as string;
    const badge = byCode[code];
    if (!badge) continue;
    const anchor = anchorFor(doc, row);
    if (!anchor) {
      detail.push(`${row.kind}:${row.anchorId ?? "no-id"}=missing`);
      continue;
    }
    if (anchor.offsetParent === null) {
      detail.push(`${row.anchorId}=hidden`);
      continue; // skip phantom/template rows
    }
    detail.push(`${row.anchorId}=shown`);
    if (anchor.querySelector(`.${BADGE_CLASS}`) || anchor.getAttribute(DONE_ATTR)) continue;
    anchor.setAttribute(DONE_ATTR, "1");
    anchor.append(makeBadge(code, badge));
    injected++;
  }
  log?.(`overlay: injected ${injected} badges [${detail.join(", ")}]`);
}

/** Debounced re-apply so PeopleSoft partial-page reloads keep their badges. */
function reapply(doc: Document, log?: (m: string) => void): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    // Only re-run when the section set changed, to avoid log/lookup spam.
    const sig = scanSections(doc)
      .map((r) => r.courseCode)
      .join(",");
    if (sig && sig !== lastSig) {
      lastSig = sig;
      void apply(doc, log);
    }
  }, 400);
}

/** Start the overlay: initial pass + observe DOM mutations. */
export function startGradeOverlay(doc: Document, log?: (m: string) => void): void {
  void apply(doc, log);
  const observer = new MutationObserver(() => reapply(doc, log));
  if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
}
