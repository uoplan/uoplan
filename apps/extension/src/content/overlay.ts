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
const POPOVER_ID = "uoplan-grade-popover";
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

function badgeText(b: GradeBadge): string {
  const parts: string[] = [];
  if (b.letter) parts.push(b.letter);
  if (b.gpa !== null) parts.push(b.gpa.toFixed(2));
  if (b.aPlusPct !== null) parts.push(`${Math.round(b.aPlusPct)}% A+`);
  return parts.join(" · ") || "grades";
}

function stat(label: string, value: string): string {
  return `<div class="uoplan-pop-stat"><span class="uoplan-pop-num">${value}</span><span class="uoplan-pop-lab">${label}</span></div>`;
}

/** Build the popover inner HTML for a course's grade summary. */
function popoverHtml(code: string, b: GradeBadge): string {
  const max = Math.max(1, ...b.bars.map((bar) => bar.count));
  const bars = b.bars
    .map((bar) => {
      const h = Math.round((bar.count / max) * 100);
      return `<div class="uoplan-pop-bar"><div class="uoplan-pop-fill" style="height:${h}%;background:${bar.color}"></div><div class="uoplan-pop-tick">${bar.grade}</div></div>`;
    })
    .join("");
  const stats = [
    b.gpa !== null
      ? stat("mean GPA", `${b.gpa.toFixed(2)}${b.letter ? ` (${b.letter})` : ""}`)
      : "",
    b.aPlusPct !== null ? stat("A+", `${Math.round(b.aPlusPct)}%`) : "",
    b.passPct !== null ? stat("pass", `${b.passPct}%`) : "",
    stat("grades", b.count.toLocaleString()),
    b.profCount > 0 ? stat("profs", String(b.profCount)) : "",
  ].join("");
  return `<div class="uoplan-pop-head">${code}</div><div class="uoplan-pop-stats">${stats}</div><div class="uoplan-pop-chart">${bars}</div>`;
}

let popover: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function ensurePopover(doc: Document): HTMLElement {
  popover ??= doc.getElementById(POPOVER_ID);
  if (!popover) {
    popover = doc.createElement("div");
    popover.id = POPOVER_ID;
    popover.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    popover.addEventListener("mouseleave", () => hidePopover());
    doc.body?.append(popover);
  }
  return popover;
}

function hidePopover(): void {
  hideTimer = setTimeout(() => popover?.classList.remove("uoplan-pop-show"), 120);
}

function showPopover(doc: Document, anchor: HTMLElement, code: string, b: GradeBadge): void {
  clearTimeout(hideTimer);
  const pop = ensurePopover(doc);
  pop.innerHTML = popoverHtml(code, b);
  pop.classList.add("uoplan-pop-show");
  const r = anchor.getBoundingClientRect();
  const top = r.bottom + 6;
  const left = Math.min(Math.max(8, r.left), (doc.defaultView?.innerWidth ?? 1024) - 248);
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

function makeBadge(doc: Document, code: string, b: GradeBadge): HTMLElement {
  const el = doc.createElement("span");
  el.className = BADGE_CLASS;
  el.tabIndex = 0;
  el.textContent = badgeText(b);
  el.title = `uoPlan grades — ${code}: ${b.count} grades`;
  const open = () => showPopover(doc, el, code, b);
  el.addEventListener("mouseenter", open);
  el.addEventListener("focus", open);
  el.addEventListener("mouseleave", hidePopover);
  el.addEventListener("blur", hidePopover);
  return el;
}

/** Element to physically attach the badge to: a TR routes to its first cell. */
function badgeHost(anchor: HTMLElement): HTMLElement {
  if (anchor.tagName === "TR") {
    return (anchor.querySelector("td") as HTMLElement | null) ?? anchor;
  }
  return anchor;
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
    const host = badgeHost(anchor);
    if (host.querySelector(`.${BADGE_CLASS}`) || host.getAttribute(DONE_ATTR)) continue;
    host.setAttribute(DONE_ATTR, "1");
    host.append(makeBadge(doc, code, badge));
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
