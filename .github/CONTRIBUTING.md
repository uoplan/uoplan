# Contributing to uoplan

Thanks for your interest in improving [`uoplan.party`](https://uoplan.party) — a
requirement-first course planner for uOttawa students. This guide covers how to set
up the project, the conventions we follow, and what we expect in a pull request.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/uoplan/uoplan/issues/new?template=bug_report.yml).
- **Suggest a feature** — open a [feature request](https://github.com/uoplan/uoplan/issues/new?template=feature_request.yml).
- **Fix data** — course, schedule, grade, or prerequisite data lives under
  `apps/scraper/data/`. Corrections there are very welcome.
- **Improve translations** — every user-facing string ships in English and
  French (see [Internationalisation](#internationalisation)).
- **Send a pull request** — see [Pull requests](#pull-requests) below.

For anything large or potentially contentious, please open an issue to discuss it
first so we can agree on the approach before you invest time in a PR.

## Project layout

uoplan is a pnpm monorepo (`apps/*`, `packages/*`):

| Path              | What it is                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `apps/web`        | Vite + React 19 SPA (the planner UI)                              |
| `apps/worker`     | Cloudflare Worker (share redirect, OG image, web-push)            |
| `apps/scraper`    | Node scrapers that produce the source JSON datasets               |
| `apps/native`     | Expo / React Native app                                           |
| `apps/cli`        | Rust enrolment CLI (`npx @uoplan/cli`)                            |
| `packages/proto`  | protobuf schemas + generated TS (single source of truth)          |
| `packages/engine` | Rust → WASM schedule-generation engine                            |
| `packages/core`   | requirements, prerequisites, state encoding, the TS↔engine bridge |
| `packages/*`      | data, calendar, transcript, ui, theme, store, i18n, analytics, …  |

Dependencies only point "downward" (`proto ← core ← {data, calendar, transcript} ←
apps`); `pnpm check:arch` enforces this. The deeper subsystems are documented under
[`docs/`](../docs/README.md) — please read the relevant doc before changing one.

## Getting started

### Prerequisites

- **pnpm** `10.27.0` (the repo pins `packageManager`; run with [Corepack](https://nodejs.org/api/corepack.html) or install it directly). Never use `npm`.
- **Node** `24.x`.
- **Rust** + [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) — required to build the
  schedule engine, which the web tests and build load.

### Install and run

```bash
pnpm install                 # install all workspace dependencies
pnpm build:engine-wasm       # build the Rust → WASM engine (needed by dev/test/build)
pnpm dev                     # start the Vite dev server (also runs generate first)
```

`pnpm dev` runs code generation (proto + data) and the engine build for you, then
starts the web app. If you only touched TypeScript, the dev server's hot reload picks
it up; rebuild the engine (`pnpm build:engine-wasm`) after changing `packages/engine`.

## Development workflow

This project uses **oxc-based tooling**, not eslint/prettier/tsc:

- `oxlint` for linting (config in `oxlint.config.ts`)
- `oxfmt` for formatting (config in `oxfmt.config.ts`)
- `tsgo` (TypeScript native preview) for typechecking

There is **no ESLint** — suppression comments use `// oxlint-disable-next-line <rule>`
with oxlint's canonical rule names (e.g. `typescript/no-explicit-any`), never
`eslint-disable`.

### Before you open a PR

Run the same checks CI runs. The fastest path is the individual scripts:

```bash
pnpm format:check     # oxfmt (run `pnpm format` to fix)
pnpm lint             # oxlint (run `pnpm lint:fix` to autofix)
pnpm typecheck        # tsgo across all packages
pnpm check:arch       # package-layering / worker-purity guardrails
pnpm check:i18n       # translation completeness / locale parity
pnpm check:fallow     # dead-code + duplication gate
pnpm test             # vitest across the workspace
```

If you changed the Rust engine, also run:

```bash
pnpm --filter @uoplan/engine test:rust
```

> **`apps/native` is excluded** from oxlint/fallow. Verify native changes with
> `pnpm --filter native exec tsc --noEmit`, `pnpm --filter native test`, and
> `pnpm exec oxfmt <files you touched>`.

Git hooks run automatically via `lefthook` (installed by `pnpm prepare`): pre-commit
runs oxfmt, oxlint, typecheck, `check:i18n`, `check:fallow`, and cargo-clippy.

### Running a single test

```bash
pnpm --filter @uoplan/core exec vitest run src/path/file.test.ts -t "case name"
```

## Internationalisation

All user-visible text in `apps/web` (and `apps/native`) must be translated into
**English** and **French (Canadian)**. The app uses [Lingui](https://lingui.dev/)
with ICU message format and **explicit string IDs** (no Lingui macros), so the
catalogs are managed by custom tooling:

1. Add the `tr("my.id")` call (or a dynamic-family entry in `scripts/i18n/dynamic-keys.ts`).
2. Run `pnpm i18n:sync` to scaffold the missing `msgid` into **both** PO files
   (`apps/web/src/locales/{en,fr-CA}/messages.po`).
3. Fill in the English and French `msgstr`.
4. `pnpm check:i18n` enforces completeness and locale parity.

Do **not** run `pnpm i18n:sync --prune` — it mass-deletes legitimately-used keys. To
remove a string, delete just that `msgid`/`msgstr` block from both PO files by hand.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) — release-please
relies on them to generate the changelog and version bumps. Format:

```
<type>(<scope>): <short summary>
```

- **type**: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `style`.
- **scope** (optional but encouraged): the area you touched — e.g. `web`, `native`,
  `worker`, `scraper`, `cli`, `engine`, `core`, `proto`, `data`, `ci`.
- **summary**: imperative, lower-case, no trailing period.

Examples from the history:

```
feat(native): make trend charts interactive with tap/drag value tooltips
fix(web): give optimization-priority drag handles an accessible name
test(engine): relax objective latency nets on throttled CI runners
```

Mark breaking changes with `!` (e.g. `feat(core)!: …`) or a `BREAKING CHANGE:` footer.

## Pull requests

1. **Fork** the repo and create a branch off `main`.
2. Make focused, surgical changes — keep unrelated refactors out of the PR.
3. Add or update tests for behaviour you change, and update relevant `docs/` pages.
4. Run the [pre-PR checks](#before-you-open-a-pr) and make sure they pass.
5. Fill out the pull-request template so reviewers have the context they need.
6. Keep the PR title in Conventional Commit form — it becomes the squash-merge subject
   and feeds release-please.

CI (`.github/workflows/ci.yml`) runs install → engine build → cargo test → lint →
format → typecheck → `check:arch` → `check:i18n` → `check:fallow` → test → build. All
of it must be green before a PR can merge.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. See
[SECURITY.md](./SECURITY.md) for how to report them privately.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](../LICENSE).
