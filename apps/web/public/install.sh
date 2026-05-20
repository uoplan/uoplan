#!/bin/sh
# uoplan CLI installer
# Usage: curl -fsSL https://uoplan.party/install.sh | sh
# Or to install to a custom directory: curl -fsSL https://uoplan.party/install.sh | sh -s -- --install-dir /usr/local/bin

set -eu

REPO="uoplan/uoplan"
BINARY_NAME="uoplan"
INSTALL_DIR="${UOPLAN_INSTALL_DIR:-}"

# ── Argument parsing ─────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --install-dir=*)
      INSTALL_DIR="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ── Platform detection ───────────────────────────────────────────────────────
detect_target() {
  local os arch

  case "$(uname -s)" in
    Darwin) os="apple-darwin" ;;
    Linux)  os="unknown-linux-gnu" ;;
    *)
      echo "error: unsupported OS: $(uname -s)" >&2
      echo "       Install uoplan manually from https://github.com/${REPO}/releases" >&2
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64 | amd64)  arch="x86_64" ;;
    arm64 | aarch64) arch="aarch64" ;;
    *)
      echo "error: unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac

  echo "${arch}-${os}"
}

# ── Resolve install directory ────────────────────────────────────────────────
resolve_install_dir() {
  if [ -n "$INSTALL_DIR" ]; then
    echo "$INSTALL_DIR"
    return
  fi

  # Prefer ~/.local/bin (XDG standard, no sudo needed)
  echo "${HOME}/.local/bin"
}

# ── Fetch latest release tag ─────────────────────────────────────────────────
fetch_latest_version() {
  local url="https://api.github.com/repos/${REPO}/releases"
  local version

  if command -v curl > /dev/null 2>&1; then
    version=$(curl -fsSL "$url" | grep '"tag_name"' | grep '"cli/' | head -1 | sed 's/.*"cli\/\(v[^"]*\)".*/\1/')
  elif command -v wget > /dev/null 2>&1; then
    version=$(wget -qO- "$url" | grep '"tag_name"' | grep '"cli/' | head -1 | sed 's/.*"cli\/\(v[^"]*\)".*/\1/')
  else
    echo "error: curl or wget is required" >&2
    exit 1
  fi

  if [ -z "$version" ]; then
    echo "error: could not determine latest release version" >&2
    exit 1
  fi

  echo "$version"
}

# ── Download ─────────────────────────────────────────────────────────────────
download() {
  local url="$1"
  local dest="$2"

  if command -v curl > /dev/null 2>&1; then
    curl -fsSL --retry 3 --retry-delay 1 -o "$dest" "$url"
  elif command -v wget > /dev/null 2>&1; then
    wget -qO "$dest" "$url"
  else
    echo "error: curl or wget is required" >&2
    exit 1
  fi
}

# ── PATH helper ──────────────────────────────────────────────────────────────
need_path_update() {
  case ":${PATH}:" in
    *":${1}:"*) return 1 ;;
    *) return 0 ;;
  esac
}

add_to_path() {
  local dir="$1"
  local shell_rc=""

  if [ -n "${BASH_VERSION:-}" ] && [ -f "${HOME}/.bashrc" ]; then
    shell_rc="${HOME}/.bashrc"
  elif [ -n "${ZSH_VERSION:-}" ] && [ -f "${HOME}/.zshrc" ]; then
    shell_rc="${HOME}/.zshrc"
  elif [ -f "${HOME}/.profile" ]; then
    shell_rc="${HOME}/.profile"
  fi

  if [ -n "$shell_rc" ]; then
    printf '\n# uoplan CLI\nexport PATH="%s:$PATH"\n' "$dir" >> "$shell_rc"
    echo "  Added to PATH in ${shell_rc}"
    echo "  Restart your shell or run: export PATH=\"${dir}:\$PATH\""
  else
    echo "  Add this to your shell profile:"
    echo "    export PATH=\"${dir}:\$PATH\""
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  printf "\033[1muoplan CLI installer\033[0m\n\n"

  TARGET=$(detect_target)
  VERSION=$(fetch_latest_version)
  INSTALL_DIR=$(resolve_install_dir)

  printf "  Target:  %s\n" "$TARGET"
  printf "  Version: %s\n" "$VERSION"
  printf "  Install: %s\n\n" "$INSTALL_DIR"

  ARCHIVE="uoplan-${TARGET}.tar.gz"
  URL="https://github.com/${REPO}/releases/download/cli%2F${VERSION}/${ARCHIVE}"

  TMPDIR=$(mktemp -d)
  trap 'rm -rf "$TMPDIR"' EXIT

  printf "Downloading %s... " "$ARCHIVE"
  download "$URL" "${TMPDIR}/${ARCHIVE}"
  echo "done"

  printf "Extracting... "
  tar -xzf "${TMPDIR}/${ARCHIVE}" -C "$TMPDIR"
  echo "done"

  mkdir -p "$INSTALL_DIR"
  mv "${TMPDIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  printf "\n\033[32m✓ uoplan %s installed to %s/%s\033[0m\n\n" "$VERSION" "$INSTALL_DIR" "$BINARY_NAME"

  if need_path_update "$INSTALL_DIR"; then
    echo "  Note: ${INSTALL_DIR} is not in your PATH."
    add_to_path "$INSTALL_DIR"
    echo ""
  fi

  echo "  Run \`uoplan --help\` to get started."
}

main
