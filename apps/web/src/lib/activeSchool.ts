import {
  DEFAULT_SCHOOL_ID,
  isSchoolId,
  schoolFromPathname,
  withoutSchoolPath,
  withSchoolPath,
} from "@uoplan/domain/school";
import { AVAILABLE_SCHOOL_IDS } from "./dataAssetIndex";
import type { SchoolId } from "@uoplan/domain/school";

const SCHOOL_STORAGE_KEY = "uoplan.school";

/**
 * The school this page load is running as.
 *
 * Resolved **once**, before the router is created, and then frozen for the
 * lifetime of the document. Everything school-dependent — the router basepath,
 * the `.pb` asset namespace, the localStorage key, which features are on —
 * derives from this value, and none of those can be swapped underneath a live
 * React tree safely. Switching schools therefore does a full navigation
 * (see {@link switchSchool}) rather than a re-render.
 *
 * Precedence is URL → remembered choice → uOttawa. The URL wins so that a
 * shared `/carleton/schedule?s=…` link opens as Carleton even for someone whose
 * last visit was uOttawa — and, symmetrically, so that a shared `/schedule?s=…`
 * link still opens as uOttawa for someone who last used Carleton.
 */
let activeSchool: SchoolId | null = null;

/** Whether a pathname is the site root (`/`, `""`, or `/index.html`). */
function isRootPath(pathname: string): boolean {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" || trimmed === "/index.html";
}

/**
 * Decide which school a page load runs as, given its path and the remembered
 * choice. Pure, so the precedence rules can be tested without a document.
 *
 * `schoolFromPathname` returns uOttawa for every unprefixed path, so the prefix
 * alone can't distinguish "the user asked for uOttawa" from "the user didn't
 * say". The path depth does: only the bare root is opinion-free.
 *
 * That distinction is the whole point. uOttawa is the unprefixed school, so
 * every link that predates Carleton — including every `/schedule?s=…` share
 * link already in the wild — is an unprefixed *deep* link. If the remembered
 * choice could override those, one visit to Carleton would permanently hijack
 * them.
 *
 * `available` is the set of schools this bundle actually ships `.pb` data for.
 * A school in the registry whose data hasn't been published yet resolves to the
 * default instead, so a stale or hand-typed `/carleton/*` URL degrades to a
 * working uOttawa page rather than an app that boots and then can't load a
 * catalogue.
 */
export function resolveActiveSchool(
  pathname: string,
  remembered: SchoolId | null,
  available: readonly SchoolId[] = [],
): SchoolId {
  const has = (school: SchoolId): boolean =>
    school === DEFAULT_SCHOOL_ID || available.length === 0 || available.includes(school);

  const fromPath = schoolFromPathname(pathname);
  if (fromPath !== DEFAULT_SCHOOL_ID || !isRootPath(pathname)) {
    return has(fromPath) ? fromPath : DEFAULT_SCHOOL_ID;
  }
  if (remembered !== null && has(remembered)) return remembered;
  return DEFAULT_SCHOOL_ID;
}

function readRememberedSchool(): SchoolId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCHOOL_STORAGE_KEY);
    return raw !== null && isSchoolId(raw) ? raw : null;
  } catch {
    // Private-mode / disabled storage: fall through to the default.
    return null;
  }
}

function rememberSchool(school: SchoolId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCHOOL_STORAGE_KEY, school);
  } catch {
    // Persisting the preference is best-effort; the URL still carries it.
  }
}

/** Separates a worker's debug name from the school it was spawned for. */
export const WORKER_NAME_SCHOOL_SEPARATOR = "#";

/**
 * The school a Web Worker was spawned for, read from its own `self.name`.
 *
 * A worker has no `window`, so it cannot see the page's pathname or
 * localStorage — left alone it resolves to uOttawa and then requests
 * `uottawa/schedules.*.pb` while running a Carleton page. The spawning side
 * therefore encodes the school into the worker's `name`.
 *
 * `name` rather than a URL query param because Vite only emits a worker chunk
 * when `new URL("./worker.ts", import.meta.url)` appears literally inside
 * `new Worker(...)`; building that URL in a variable to attach a query silently
 * drops the worker from the bundle. `self.name` is set by the constructor and is
 * readable at module-evaluation time, which is what matters here: the worker's
 * module graph (including the data client, which binds its asset namespace at
 * module scope) is evaluated *before* any Comlink message could arrive, so
 * passing the school in an `init()` call would be too late.
 */
function schoolFromWorkerScope(): SchoolId | null {
  if (typeof window !== "undefined") return null;
  const name = (globalThis as { name?: string }).name;
  if (name === undefined || name === "") return null;
  const raw = name.slice(name.lastIndexOf(WORKER_NAME_SCHOOL_SEPARATOR) + 1);
  return isSchoolId(raw) ? raw : null;
}

/**
 * Resolve and freeze the active school. Safe to call more than once — only the
 * first call decides. Must run before `createRouter`, which needs the basepath.
 */
export function initializeActiveSchool(): SchoolId {
  if (activeSchool !== null) return activeSchool;

  const fromWorker = schoolFromWorkerScope();
  if (fromWorker !== null) {
    activeSchool = fromWorker;
    return activeSchool;
  }

  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const fromPath = schoolFromPathname(pathname);

  activeSchool = resolveActiveSchool(pathname, readRememberedSchool(), AVAILABLE_SCHOOL_IDS);

  // Reconcile the URL with the resolved school so it always states the school
  // the app is actually running as — matching what every in-app link produces.
  // Two cases reach here: a remembered non-default school on the bare root
  // (add the prefix), and a prefixed URL for a school with no published data
  // (drop it, having fallen back to the default).
  if (activeSchool !== fromPath) {
    const w = globalThis.window as Window | undefined;
    if (w !== undefined) {
      const next = withSchoolPath(activeSchool, withoutSchoolPath(fromPath, pathname));
      w.history.replaceState({}, "", `${next}${w.location.search}${w.location.hash}`);
    }
  }

  rememberSchool(activeSchool);
  return activeSchool;
}

/**
 * The frozen active school, resolving it on first use.
 *
 * This is deliberately self-initializing. ES module initialisation is hoisted,
 * so a module-scope consumer (`dataClient`, the store key, …) can evaluate
 * before `main.tsx` reaches its `initializeActiveSchool()` call. Returning a
 * silent uOttawa default there would bind the data client to the wrong school's
 * assets on a `/carleton/*` page — which is exactly the bug this guards.
 */
export function getActiveSchool(): SchoolId {
  return activeSchool ?? initializeActiveSchool();
}

/**
 * Switch schools by remembering the choice and doing a **full page load** at
 * the equivalent path under the new school.
 *
 * A hard navigation is deliberate: the data client, the store, the router
 * basepath and the WASM engine's warmed catalogue are all bound to one school
 * at construction, so tearing the document down is the only way to guarantee no
 * uOttawa state leaks into a Carleton session (or vice versa).
 */
export function switchSchool(school: SchoolId): void {
  if (typeof window === "undefined" || school === getActiveSchool()) return;
  rememberSchool(school);
  // Drop `?s=` — a state blob is indexed against the old school's `indices.pb`
  // and would decode to nonsense (or fail) under the new one.
  const neutral = withoutSchoolPath(getActiveSchool(), window.location.pathname);
  window.location.assign(withSchoolPath(school, neutral));
}
