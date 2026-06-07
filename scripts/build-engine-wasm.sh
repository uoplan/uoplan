#!/usr/bin/env bash
#
# Build the Rust -> WASM schedule engine (packages/engine), bootstrapping the
# Rust toolchain + wasm-pack first if they are missing.
#
# Why this exists: CI and local dev already have Rust + wasm-pack, but the
# Cloudflare Workers Builds container ships only Node + pnpm. Without a toolchain
# the build fails with `sh: 1: wasm-pack: not found`. Running the install and the
# `wasm-pack` invocation in this single shell means the PATH we export below is
# in scope for the build step — which would NOT be the case across separate
# `&&`-chained npm scripts.
#
# Idempotent: a no-op once the toolchain is present (the normal case locally/CI).
#
# Usage:
#   bash scripts/build-engine-wasm.sh            # release build
#   bash scripts/build-engine-wasm.sh --dev      # dev build
set -euo pipefail

PROFILE_FLAG="--release"
if [[ "${1:-}" == "--dev" ]]; then
  PROFILE_FLAG="--dev"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine_dir="$script_dir/../packages/engine"

export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"

if ! command -v rustup >/dev/null 2>&1 && ! command -v cargo >/dev/null 2>&1; then
  echo "[build-engine-wasm] Rust toolchain not found; installing (stable, minimal)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable
fi

# Ensure the wasm target exists (idempotent). Only meaningful when rustup is the
# toolchain manager; harmless to skip otherwise.
if command -v rustup >/dev/null 2>&1; then
  rustup target add wasm32-unknown-unknown
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "[build-engine-wasm] wasm-pack not found; installing..."
  curl --proto '=https' --tlsv1.2 -sSf \
    https://rustwasm.github.io/wasm-pack/installer/init.sh | sh
fi

echo "[build-engine-wasm] using $(rustc --version 2>/dev/null || echo 'rustc ?'), wasm-pack $(wasm-pack --version 2>/dev/null || echo '?')"

cd "$engine_dir"
exec wasm-pack build --target web --out-dir pkg "$PROFILE_FLAG"
