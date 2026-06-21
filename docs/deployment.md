# Deployment & Cloudflare build caching

uoplan deploys to Cloudflare Workers Builds (git-connected). The deploy runs the
repo build (`pnpm build:cf`), then deploys with the **compiled** wrangler config
that the build emits at `apps/web/dist/uoplan/wrangler.json`:

- **Production branch:** `pnpm run deploy:cf`
  (`wrangler deploy -c apps/web/dist/uoplan/wrangler.json`)
- **Non-production branches** (previews, incl. the `release-please` PR branch):
  `pnpm run upload:cf`
  (`wrangler versions upload -c apps/web/dist/uoplan/wrangler.json`)

> **Both commands must pass `-c apps/web/dist/uoplan/wrangler.json`.** The repo-root
> `wrangler.json` deliberately omits `assets.directory` — `@cloudflare/vite-plugin`
> injects it at build time into the compiled config (`"directory": "../client"`,
> i.e. `apps/web/dist/client`). Running a bare `wrangler deploy` / `wrangler versions
upload` loads the root config instead and fails with
> `The 'assets' property in your configuration is missing the required 'directory'
property.`

## Why the build is slow by default

The build runs `pnpm build`, which runs `pnpm build:engine-wasm`
([`scripts/build-engine-wasm.sh`](../scripts/build-engine-wasm.sh)). On a cold build this:

1. Installs the nightly Rust toolchain + `rust-src` + the `wasm32-unknown-unknown` target.
2. Downloads the crates.io index and all crate sources.
3. Compiles `std` (via `-Z build-std`) + `wasm-bindgen` + the `uoplan-engine` crate.

None of that is cached by Cloudflare out of the box.

> The build log line `Skipping build output cache as it's not supported for your project`
> is **unrelated** — that is Cloudflare's _framework_ build-output cache (Astro/Next/etc.),
> which uoplan doesn't use. It does not refer to the Rust build.

## How the Rust build is cached

Cloudflare Workers Builds' build cache can only cache a fixed set of directories — for pnpm
that is the project-root **`.pnpm-store`**. It [cannot be told to cache arbitrary paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-caching/)
like `~/.cargo` or `packages/engine/target`.

[`scripts/cf-build.sh`](../scripts/cf-build.sh) (run via `pnpm build:cf`) works around this by
redirecting Rust's toolchain / registry / build output into subdirectories of `.pnpm-store`, so
they are cached and restored together with the pnpm store:

| Env var            | Location                   | Caches                                  |
| ------------------ | -------------------------- | --------------------------------------- |
| `RUSTUP_HOME`      | `.pnpm-store/rustup`       | nightly toolchain + `rust-src`          |
| `CARGO_HOME`       | `.pnpm-store/cargo-home`   | rustup/cargo shims, registry, crates    |
| `CARGO_TARGET_DIR` | `.pnpm-store/cargo-target` | compiled `std`, crates, and wasm output |

`build-engine-wasm.sh` already honours all three (it uses `${VAR:-default}` and puts
`$CARGO_HOME/bin` on `PATH`), so a warm build skips the toolchain install + crate downloads and
only does an incremental compile.

## One-time Cloudflare dashboard setup

In the Cloudflare dashboard → your Worker project → **Settings → Build**:

1. **Build command** → `pnpm build:cf`
2. **Build cache** → **Enable**
3. **Deploy command (production branch)** → `pnpm run deploy:cf`
4. **Deploy command (non-production branches)** → `pnpm run upload:cf`

Both deploy commands pass the compiled config (`-c apps/web/dist/uoplan/wrangler.json`)
— see the note at the top of this doc for why that is required.

## Notes / caveats

- This is an **unsupported workaround**: it relies on Cloudflare caching a project-root
  `.pnpm-store`. If a build looks like it isn't reusing the cargo cache, check the build logs to
  confirm `.pnpm-store` is restored, and that the `cargo-*`/`rustup` subdirs ride along.
- Cargo + toolchain artifacts are ~0.5–1 GB; Cloudflare allows 10 GB per project (least-recently-read
  artifacts are purged first), so this fits with room to spare.
- `.pnpm-store` is git-ignored, so none of these cached dirs are ever committed.
- **Fallback** if the cache hack stops paying off: stop compiling Rust on Cloudflare — commit
  `packages/engine/pkg`, point the Cloudflare build command at a variant that skips
  `build:engine-wasm`, and add a CI check that fails when `pkg` is stale relative to the Rust
  sources.
