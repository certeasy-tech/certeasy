#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"

# Fallback to known install paths if not in PATH
if ! command -v "$NPM_BIN" &>/dev/null; then
  for candidate in /usr/local/bin/npm /usr/bin/npm; do
    if [ -x "$candidate" ]; then
      NPM_BIN="$candidate"
      break
    fi
  done
fi

MODE="${1:-build}"

cd "$SCRIPT_DIR"

case "$MODE" in
  build)
    echo "Building documentation site..."
    "$NPM_BIN" run build
    ;;
  dev|start)
    echo "Starting documentation dev server..."
    "$NPM_BIN" start
    ;;
  serve)
    echo "Serving built documentation..."
    "$NPM_BIN" run serve
    ;;
  *)
    echo "Usage: $0 [build|dev|serve]"
    echo "  build  — compile the static site (default







    )"
    echo "  dev    — start hot-reload dev server"
    echo "  serve  — serve the previously built site"
    exit 1
    ;;
esac
