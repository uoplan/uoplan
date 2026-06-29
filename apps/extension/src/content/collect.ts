import type { DomEvent, SectionRow } from "../shared/messages";

/**
 * Serializes a compact, depth-limited outline of the current frame's DOM so the
 * agent can understand uoCampus's (PeopleSoft) structure remotely without a
 * screenshot. Output is intentionally terse: tag + id + a couple of classes +
 * truncated text, capped in depth, breadth, and total size.
 */

const MAX_DEPTH = 16;
const MAX_CHILDREN_PER_NODE = 60;
const MAX_OUTLINE_CHARS = 40_000;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "LINK", "META"]);

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
  const name = el.getAttribute("name");
  const nameAttr = name ? `[name=${name}]` : "";
  return `${tag}${id}${cls}${nameAttr}`;
}

function directText(el: Element): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  }
  text = text.replaceAll(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/** Build the depth-limited outline string. */
function outlineFrame(root: Element): string {
  const lines: string[] = [];
  let total = 0;

  function walk(el: Element, depth: number): void {
    if (total >= MAX_OUTLINE_CHARS || depth > MAX_DEPTH) return;
    if (SKIP_TAGS.has(el.tagName)) return;

    const text = directText(el);
    const line = `${"  ".repeat(depth)}${describe(el)}${text ? ` "${text}"` : ""}`;
    lines.push(line);
    total += line.length + 1;

    const children = Array.from(el.children).slice(0, MAX_CHILDREN_PER_NODE);
    for (const child of children) walk(child, depth + 1);
    if (el.children.length > MAX_CHILDREN_PER_NODE) {
      lines.push(`${"  ".repeat(depth + 1)}…(+${el.children.length - MAX_CHILDREN_PER_NODE} more)`);
    }
  }

  walk(root, 0);
  return lines.join("\n");
}

/** Count PeopleSoft-flavoured structural markers to flag what a frame contains. */
function countMarkers(doc: Document): Record<string, number> {
  const q = (sel: string): number => doc.querySelectorAll(sel).length;
  return {
    iframes: q("iframe"),
    tables: q("table"),
    forms: q("form"),
    // PeopleSoft conventions.
    ptFrames: q("iframe[id*='ptifrm'], iframe#ptifrmtgtframe"),
    win0Forms: q("form[id^='win0'], form[name^='win0']"),
    psHyperlinks: q("a.PSHYPERLINK, a.PSHYPERLINKDISABLED"),
    psEditBoxes: q("input.PSEDITBOX, .PSEDITBOX"),
    psGrids: q("table.PSLEVEL1GRID, table.PSLEVEL1GRIDNBO, .PSGRIDCOUNTER"),
    psPushButtons: q("a.PSPUSHBUTTON, input.PSPUSHBUTTON"),
  };
}

/** Course code embedded in a section label, e.g. "ADM1100-A LEC" → "ADM1100". */
const COURSE_CODE_RE = /\b([A-Z]{2,4})\s?(\d{3,4})\b/;

function rowText(doc: Document, id: string): string {
  const el = doc.querySelector(`[id='${CSS.escape(id)}']`);
  return el ? (el.textContent ?? "").replaceAll(/\s+/g, " ").trim() : "";
}

/**
 * Parse PeopleSoft class-search/result/component rows into the structured shape
 * the grade overlay anchors to. Mirrors apps/cli (src/api/search.rs): search
 * rows keyed by `MTG_CLASS_NBR$N` (+ `MTG_CLASSNAME/DAYTIME/INSTR$N`, status img),
 * component sub-tables as `tr[id^='trSSR_CLS_TBL_R*']` with ≥7 cells.
 */
export function scanSections(doc: Document): SectionRow[] {
  const rows: SectionRow[] = [];

  for (const a of Array.from(doc.querySelectorAll<HTMLElement>("a[id^='MTG_CLASS_NBR$']"))) {
    const index = Number.parseInt(a.id.split("$")[1] ?? "", 10);
    if (Number.isNaN(index)) continue;
    const name = rowText(doc, `MTG_CLASSNAME$${index}`);
    const statusImg = doc.querySelector<HTMLImageElement>(
      `[id*='SSR_STATUS_LONG$${index}'] img, img[id*='STATUS$${index}']`,
    );
    rows.push({
      kind: "search",
      index,
      classNbr: (a.textContent ?? "").trim(),
      name,
      courseCode: COURSE_CODE_RE.exec(name)?.slice(1, 3).join("") || undefined,
      days: rowText(doc, `MTG_DAYTIME$${index}`),
      instructor: rowText(doc, `MTG_INSTR$${index}`),
      status: statusImg?.alt ?? "",
      anchorId: `MTG_CLASS_NBR$${index}`,
    });
  }

  for (const tr of Array.from(doc.querySelectorAll("tr[id^='trSSR_CLS_TBL_R']"))) {
    const cells = Array.from(tr.querySelectorAll("td"));
    if (cells.length < 7) continue;
    const cell = (i: number): string =>
      (cells[i]?.textContent ?? "").replaceAll(/\s+/g, " ").trim();
    const name = cell(2);
    rows.push({
      kind: "component",
      index: rows.length,
      classNbr: cell(1),
      name,
      courseCode: COURSE_CODE_RE.exec(name)?.slice(1, 3).join("") || undefined,
      days: cell(3),
      instructor: cell(5),
      status: cells[6]?.querySelector("img")?.getAttribute("alt") ?? "",
      anchorId: tr.id || undefined,
    });
  }

  // Enrollment cart / schedule rows (mirrors apps/cli cart.rs): a course row has
  // a `P_CLASS_NAME$buf` label; bufnum comes from the `trSSR_REGFORM_VW` ancestor.
  for (const nameEl of Array.from(doc.querySelectorAll<HTMLElement>("[id^='P_CLASS_NAME$']"))) {
    const buf = nameEl.id.split("$")[1] ?? "";
    if (!buf) continue;
    const name = (nameEl.textContent ?? "").replaceAll(/\s+/g, " ").trim();
    const code = COURSE_CODE_RE.exec(name)?.slice(1, 3).join("") || undefined;
    if (!code) continue;
    rows.push({
      kind: "cart",
      index: rows.length,
      classNbr: "",
      name,
      courseCode: code,
      days: "",
      instructor: rowText(doc, `DERIVED_REGFRM1_SSR_INSTR_LONG$${buf}`),
      status: "",
      anchorId: nameEl.id,
    });
  }

  return rows;
}

/** Produce a full {@link DomEvent} snapshot for `doc`. */
export function collectDom(doc: Document, inFrame: boolean): DomEvent {
  const sections = scanSections(doc);
  return {
    type: "dom",
    ts: Date.now(),
    source: "content",
    url: doc.location?.href,
    inFrame,
    title: doc.title,
    outline: doc.documentElement ? outlineFrame(doc.documentElement) : "(no document element)",
    markers: countMarkers(doc),
    sections: sections.length > 0 ? sections : undefined,
  };
}
