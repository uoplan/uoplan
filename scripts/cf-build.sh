#!/usr/bin/env bash
#
# Cloudflare Workers Builds entry point.
#
# Cloudflare's build cache can only cache a fixed set of directories — for pnpm
# that is the project-root `.pnpm-store`. It cannot be told to cache arbitrary
# paths like `~/.cargo` or `packages/engine/target`, so the Rust -> WASM engine
# (scripts/build-engine-wasm.sh) would otherwise reinstall the toolchain,
# re-download crates, and recompile from scratch on every deploy.
#
# Work around that by redirecting Rust's toolchain / registry / build output
# into subdirectories of `.pnpm-store`, so they get cached and restored together
# with the pnpm store. build-engine-wasm.sh already honours these env vars
# (`${VAR:-default}` + `export PATH="$CARGO_HOME/bin:$PATH"`), so a warm build
# skips toolchain install + crate downloads and only does incremental compiles.
#
# Cloudflare setup (dashboard, one-time):
#   * Settings > Build > Build command:  pnpm build:cf
#   * Settings > Build > Build cache:     Enable
# Deploy command is unchanged.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cache_dir="$repo_root/.pnpm-store"

export RUSTUP_HOME="$cache_dir/rustup"
export CARGO_HOME="$cache_dir/cargo-home"
export CARGO_TARGET_DIR="$cache_dir/cargo-target"

mkdir -p "$RUSTUP_HOME" "$CARGO_HOME" "$CARGO_TARGET_DIR"

echo "[cf-build] caching Rust artifacts under $cache_dir (RUSTUP_HOME/CARGO_HOME/CARGO_TARGET_DIR)"

cd "$repo_root"
exec pnpm build
