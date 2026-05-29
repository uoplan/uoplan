/**
 * `@uoplan/proto` — the single source of truth for protobuf schemas shared
 * across the web app, Cloudflare worker, scrapers, and (via `proto/cli.proto`)
 * the Rust CLI.
 *
 * The generated TypeScript under `src/generated/` is produced by
 * `pnpm --filter @uoplan/proto generate` and is git-ignored; consumers import
 * either the grouped namespaces below or the per-schema subpaths
 * (`@uoplan/proto/data`, `@uoplan/proto/state`, `@uoplan/proto/cli`).
 */
export * as DataProto from "./generated/data";
export * as StateProto from "./generated/state";
export * as CliProto from "./generated/cli";
