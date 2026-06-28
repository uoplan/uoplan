import type { DomEvent } from "../shared/messages";

/**
 * Serializes a compact, depth-limited outline of the current frame's DOM so the
 * agent can understand uoCampus's (PeopleSoft) structure remotely without a
 * screenshot. Output is intentionally terse: tag + id + a couple of classes +
 * truncated text, capped in depth, breadth, and total size.
 */

const MAX_DEPTH = 14;
const MAX_CHILDREN_PER_NODE = 40;
const MAX_OUTLINE_CHARS = 24_000;
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

/** Produce a full {@link DomEvent} snapshot for `doc`. */
export function collectDom(doc: Document, inFrame: boolean): DomEvent {
  return {
    type: "dom",
    ts: Date.now(),
    source: "content",
    url: doc.location?.href,
    inFrame,
    title: doc.title,
    outline: doc.documentElement ? outlineFrame(doc.documentElement) : "(no document element)",
    markers: countMarkers(doc),
  };
}
