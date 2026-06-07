#!/usr/bin/env bash
#
# Cloudflare Workers Builds bootstrap.
#
# The Cloudflare build container ships Node + pnpm but no Rust toolchain, while
# our Rust -> WASM schedule engine (packages/engine) requires `cargo`/`rustc` plus
# `wasm-pack` to build (`pnpm build` -> `build:engine-wasm`). Without them the
# build fails with `sh: 1: wasm-pack: not found`.
#
# Point the Cloudflare project's *Build command* at this script:
#
#     bash scripts/cf-build.sh
#
# It installs the toolchain on demand (idempotent — a no-op once cached/present),
# then runs the normal production build.
set -euo pipefail

export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"

if ! command -v rustup >/dev/null 2>&1; then
  echo "[cf-build] installing Rust toolchain (stable, minimal)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable
fi

# Idempotent: ensures the wasm target is present for wasm-pack.
rustup target add wasm32-unknown-unknown

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "[cf-build] installing wasm-pack..."
  curl --proto '=https' --tlsv1.2 -sSf \
    https://rustwasm.github.io/wasm-pack/installer/init.sh | sh
fi

echo "[cf-build] toolchain ready: $(rustc --version), wasm-pack $(wasm-pack --version)"

pnpm build
