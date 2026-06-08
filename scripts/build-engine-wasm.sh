#!/usr/bin/env bash
#
# Build the Rust -> WASM schedule engine (packages/engine), bootstrapping the
# Rust toolchain + wasm-pack first if they are missing.
#
# Usage:
#   bash scripts/build-engine-wasm.sh            # release build
#   bash scripts/build-engine-wasm.sh --dev      # dev build
# Idempotently installs missing Rust/wasm-pack tools before building.
set -euo pipefail

PROFILE_FLAG="--release"
CARGO_FEATURE_ARGS=()
if [[ "${1:-}" == "--dev" ]]; then
  PROFILE_FLAG="--dev"
  # Readable panics in the browser console for local dev only; release omits this
  # to keep the binary small.
  CARGO_FEATURE_ARGS=(--features console_error_panic_hook)
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine_dir="$script_dir/../packages/engine"

export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"

# The wasm build uses `-Z build-std` (optimize_for_size) + nightly-only rustflags
# (see packages/engine/.cargo/config.toml) to shrink the binary, so it must run on
# a nightly toolchain with the `rust-src` component. We pin nightly for THIS build
# only via RUSTUP_TOOLCHAIN; the rest of the repo (tests, typecheck) stays on stable.
export RUSTUP_TOOLCHAIN="${UOPLAN_ENGINE_TOOLCHAIN:-nightly}"

if ! command -v rustup >/dev/null 2>&1 && ! command -v cargo >/dev/null 2>&1; then
  echo "[build-engine-wasm] Rust toolchain not found; installing rustup + ${RUSTUP_TOOLCHAIN}..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "$RUSTUP_TOOLCHAIN" --component rust-src
fi

# Ensure the nightly toolchain, rust-src (for build-std), and the wasm target are
# present (all idempotent). Only meaningful when rustup is the toolchain manager.
if command -v rustup >/dev/null 2>&1; then
  rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal --component rust-src 2>/dev/null \
    || rustup component add rust-src --toolchain "$RUSTUP_TOOLCHAIN"
  rustup target add wasm32-unknown-unknown --toolchain "$RUSTUP_TOOLCHAIN"
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "[build-engine-wasm] wasm-pack not found; installing..."
  curl --proto '=https' --tlsv1.2 -sSf \
    https://rustwasm.github.io/wasm-pack/installer/init.sh | sh
fi

echo "[build-engine-wasm] using $(rustc --version 2>/dev/null || echo 'rustc ?'), wasm-pack $(wasm-pack --version 2>/dev/null || echo '?')"

cd "$engine_dir"
exec wasm-pack build --target web --out-dir pkg "$PROFILE_FLAG" -- ${CARGO_FEATURE_ARGS[@]+"${CARGO_FEATURE_ARGS[@]}"}
