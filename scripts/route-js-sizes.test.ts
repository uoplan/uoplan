import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, beforeEach, test } from "node:test";
import {
  collectReport,
  parseInitialGraphReferences,
  parseRouteTreeMappings,
  parseStaticImportSpecifiers,
} from "./route-js-sizes.ts";

const scratchDir = resolve(dirname(fileURLToPath(import.meta.url)), ".route-js-sizes-test-output");

function resetScratch(): void {
  rmSync(scratchDir, { force: true, recursive: true });
  mkdirSync(join(scratchDir, "client/assets"), { recursive: true });
}

function writeFixtureFile(relativePath: string, contents: string): void {
  const path = join(scratchDir, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

beforeEach(resetScratch);

after(() => {
  rmSync(scratchDir, { force: true, recursive: true });
});

void test("parseInitialGraphReferences returns the entry module and modulepreload chunks", () => {
  const refs = parseInitialGraphReferences(`
    <link rel="stylesheet" href="/assets/app.css">
    <link rel="modulepreload" crossorigin href="/assets/shared-111.js">
    <script crossorigin type="module" src="/assets/index-222.js"></script>
  `);

  assert.deepEqual(refs, ["assets/index-222.js", "assets/shared-111.js"]);
});

void test("parseStaticImportSpecifiers finds static imports without counting dynamic imports", () => {
  const specs = parseStaticImportSpecifiers(`
    import { a } from "./a.js";
    import "./b.js";
    export { c } from "./c.js";
    const lazy = () => import("./lazy.js");
  `);

  assert.deepEqual(specs, ["./a.js", "./b.js", "./c.js"]);
});

void test("parseStaticImportSpecifiers finds Vite-minified static imports and exports", () => {
  const specs = parseStaticImportSpecifiers(
    `import{o as e,t}from"./react-DtrESx-C.js";import"./side-effect.js";export{a as b}from"./chunk-a.js";export*from"./chunk-b.js";const lazy=()=>import("./lazy.js");`,
  );

  assert.deepEqual(specs, [
    "./chunk-a.js",
    "./chunk-b.js",
    "./react-DtrESx-C.js",
    "./side-effect.js",
  ]);
});

void test("parseRouteTreeMappings maps TanStack route imports to full paths", () => {
  const mappings = parseRouteTreeMappings(`
    import { Route as ExploreRouteRouteImport } from './routes/explore/route'
    import { Route as ExploreCourseCourseIndexRouteImport } from './routes/explore/course/$course/index'
    declare module '@tanstack/react-router' {
      interface FileRoutesByPath {
        '/explore': {
          fullPath: '/explore'
          preLoaderRoute: typeof ExploreRouteRouteImport
        }
        '/explore/course/$course/': {
          fullPath: '/explore/course/$course/'
          preLoaderRoute: typeof ExploreCourseCourseIndexRouteImport
        }
      }
    }
  `);

  assert.deepEqual(mappings, [
    {
      fullPath: "/explore",
      importName: "ExploreRouteRouteImport",
      routeSource: "src/routes/explore/route",
    },
    {
      fullPath: "/explore/course/$course/",
      importName: "ExploreCourseCourseIndexRouteImport",
      routeSource: "src/routes/explore/course/$course/index",
    },
  ]);
});

void test("collectReport includes initial HTML chunks plus route chunks and static imports", () => {
  writeFixtureFile(
    "client/index.html",
    `<link rel="modulepreload" href="/assets/shared-111.js">
     <script type="module" src="/assets/index-222.js"></script>`,
  );
  writeFixtureFile("client/assets/index-222.js", `import "./shared-111.js";`);
  writeFixtureFile("client/assets/shared-111.js", `export const shared = true;`);
  writeFixtureFile(
    "client/assets/explore-333.js",
    `import "./route-helper-444.js"; import "./shared-111.js";`,
  );
  writeFixtureFile("client/assets/route-helper-444.js", `export const routeHelper = true;`);
  writeFixtureFile("client/assets/component-555.js", `import "./component-helper-666.js";`);
  writeFixtureFile("client/assets/component-helper-666.js", `export const componentHelper = true;`);
  writeFixtureFile(
    "client/assets/explore-333.js.map",
    JSON.stringify({ sources: ["../../../src/routes/explore/route.tsx"] }),
  );
  writeFixtureFile(
    "client/assets/component-555.js.map",
    JSON.stringify({ sources: ["../../../src/routes/explore/route.tsx?tsr-split=component"] }),
  );
  writeFixtureFile(
    "routeTree.gen.ts",
    `
      import { Route as ExploreRouteRouteImport } from './routes/explore/route'
      declare module '@tanstack/react-router' {
        interface FileRoutesByPath {
          '/explore': {
            fullPath: '/explore'
            preLoaderRoute: typeof ExploreRouteRouteImport
          }
        }
      }
    `,
  );

  const report = collectReport({
    clientDir: join(scratchDir, "client"),
    routeTreePath: join(scratchDir, "routeTree.gen.ts"),
  });
  const route = report.routes.find((candidate) => candidate.route === "/explore");

  assert.equal(report.initial.chunkCount, 2);
  assert(route);
  assert.deepEqual(route.chunks.toSorted(), [
    "assets/component-555.js",
    "assets/component-helper-666.js",
    "assets/explore-333.js",
    "assets/index-222.js",
    "assets/route-helper-444.js",
    "assets/shared-111.js",
  ]);
  assert.equal(
    report.chunks.some((chunk) => chunk.id === "assets/explore-333.js"),
    true,
  );
});

void test("collectReport reports a clear error when the built client is missing", () => {
  const missingClient = join(scratchDir, "missing-client");

  assert.equal(existsSync(missingClient), false);
  assert.throws(
    () =>
      collectReport({
        clientDir: missingClient,
        routeTreePath: join(scratchDir, "routeTree.gen.ts"),
      }),
    /No built client/,
  );
});
