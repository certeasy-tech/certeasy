#!/bin/bash
# Runner for the documentation site.
#
# Uses a local npm when there is one, and falls back to npm inside a container
# otherwise — the Mac used for the docs has no node installed, and installing a
# toolchain to build a static site is not worth it.
#
#   ./run.sh                 build the static site (default)
#   ./run.sh dev             hot-reload dev server on :3000
#   ./run.sh serve           serve the previously built site on :3000
#   ./run.sh install         install dependencies only
#   ./run.sh npm <args...>   any other npm command
#
# Environment:
#   RUN_MODE=docker|local    force one or the other (default: auto-detect)
#   HORTVAL_DOCKER           docker command; when unset on macOS it is set by
#                            Core/scripts/colima-rosetta.sh (see below)
#   HORTVAL_NO_COLIMA=1      skip that helper entirely
#   COLIMA_HELPER            path to the helper (default: ../../Core/scripts/…)
#   NODE_IMAGE               container image (default: node:20 — matches
#                            package.json engines and the CI workflow)
#   PORT                     host port for dev/serve (default: 3000)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# On macOS the docker route is not a fixed context name. Core's colima helper
# CREATES and prepares the VM — Rosetta for the amd64 images, the shared tmp
# mount, the repo mount — then exports HORTVAL_DOCKER for the profile it
# actually used. Sourcing it is what makes this script and the Core test runners
# talk to the SAME VM; hardcoding a context name here would name a VM that may
# not exist yet. It is a no-op off macOS, and already yields to a preset
# HORTVAL_DOCKER.
COLIMA_HELPER="${COLIMA_HELPER:-$SCRIPT_DIR/../../Core/scripts/colima-rosetta.sh}"
if [ -f "$COLIMA_HELPER" ]; then
  # shellcheck source=/dev/null
  . "$COLIMA_HELPER"
  if ! ensure_colima_rosetta; then
    echo "warning: the colima helper returned non-zero — continuing with the" >&2
    echo "         docker routing as it stands; the check below decides." >&2
  fi
elif [ "$(uname -s)" = Darwin ] && [ -z "${HORTVAL_DOCKER:-}" ]; then
  # /Doc can be cloned without Core beside it. Say so, rather than fail later on
  # a context nobody ever set up.
  echo "note: $COLIMA_HELPER not found — using plain docker." >&2
  echo "      Set HORTVAL_DOCKER if your daemon needs a context." >&2
fi
HORTVAL_DOCKER="${HORTVAL_DOCKER:-docker}"

# Same default as the helper, so the "recreate the VM" hint names the profile
# the helper actually uses instead of one this script invented.
_profile="${HORTVAL_COLIMA_PROFILE:-rosetta}"

# `docker -v` resolves its source path against the VM's filesystem, not the
# Mac's. colima does not necessarily expose the repo at the same path on both
# sides, so the host path this script sits in may simply not exist over there —
# and an absent source is not an error: it mounts EMPTY.
#
# Rather than decide which root is right, list both and let the probe below say.
# The helper exports the pair when it ran; the fallbacks match its own defaults
# for the case where it did not.
mount_candidates() {
  echo "$SCRIPT_DIR"
  local mac="${HORTVAL_REPO_MAC:-/Volumes/DATA/SRC/CertEasy}"
  local vm="${HORTVAL_REPO_VM:-/DATA/SRC/CertEasy}"
  case "$SCRIPT_DIR" in
    "$mac"/*) echo "${vm}${SCRIPT_DIR#"$mac"}" ;;
    "$vm"/*)  echo "${mac}${SCRIPT_DIR#"$vm"}" ;;
  esac
}

# Set by assert_docker_ready once a candidate is known to work; every docker run
# below mounts THIS, never $SCRIPT_DIR.
MOUNT_DIR="$SCRIPT_DIR"

NODE_IMAGE="${NODE_IMAGE:-node:20}"
PORT="${PORT:-3000}"

# node_modules lives in a named volume, not on the bind mount. Docusaurus
# installs tens of thousands of small files, and doing that across a colima
# share (virtiofs/sshfs) is slow enough to look broken. The build output stays
# on the bind mount — that is the part worth seeing from the host.
MODULES_VOLUME="${MODULES_VOLUME:-hortval-docs-node-modules}"

# --------------------------------------------------------------------------
# Which runner
# --------------------------------------------------------------------------
MODE="${RUN_MODE:-auto}"
if [ "$MODE" = auto ]; then
  if command -v npm >/dev/null 2>&1; then MODE=local; else MODE=docker; fi
fi

# --user is Linux-only. On macOS the colima/Docker Desktop sharing layer
# presents the mount root-owned inside the container — a non-root --user cannot
# write to it — and remaps files created by the container back to the host user
# anyway. Measured in this repository; see Core tests-acme/CLAUDE.md.
host_user_flag() {
  if [ "$(uname -s)" = Linux ]; then printf -- '--user %s:%s' "$(id -u)" "$(id -g)"; fi
}

tty_flags() {
  if [ -t 0 ] && [ -t 1 ]; then printf -- '-it'; else printf -- '-i'; fi
}

# Both docker preconditions, checked where they are needed rather than at the
# top of the script — a guard that runs before the dispatch makes `--help`
# unreadable on exactly the machine whose problem the help explains.
#
# The second one matters because of how colima fails: the share is fixed when
# the VM is created, so a directory outside it is not an error the daemon
# reports — the mount is simply EMPTY inside the container. Probing for a file
# we know is there turns that silent case into a message naming the cause.
assert_docker_ready() {
  if ! $HORTVAL_DOCKER version >/dev/null 2>&1; then
    echo "error: '$HORTVAL_DOCKER' is not reachable." >&2
    echo "  Start the VM (colima start), point HORTVAL_DOCKER at a working" >&2
    echo "  docker, or install node >=20 and re-run with RUN_MODE=local." >&2
    exit 1
  fi
  # Run WITHOUT the mount first. Otherwise every reason a container can fail to
  # start — image not pulled yet, no disk, a broken context — is reported as
  # "your path is not shared", which sends the operator off to delete a VM that
  # was fine. Discriminate before concluding.
  local err
  if ! err=$($HORTVAL_DOCKER run --rm "$NODE_IMAGE" true 2>&1); then
    echo "error: cannot run a container at all (image $NODE_IMAGE, no mount involved):" >&2
    printf '  %s\n' "$err" >&2
    echo "  If it is just the first run, the image has to be pulled: $HORTVAL_DOCKER pull $NODE_IMAGE" >&2
    exit 1
  fi

  # Now the mount. The share is fixed when the colima VM is created, so a path
  # outside it is not an error the daemon reports — it mounts as an EMPTY
  # directory. Probing a file we know is there turns that silence into a cause.
  # read -r, not $(...) word splitting: a macOS path may contain spaces, and the
  # process substitution keeps the loop in this shell so `return` works.
  local candidate tried=""
  while IFS= read -r candidate; do
    if $HORTVAL_DOCKER run --rm -v "$candidate:/app" -w /app "$NODE_IMAGE" \
         test -f package.json >/dev/null 2>&1; then
      MOUNT_DIR="$candidate"
      [ "$candidate" = "$SCRIPT_DIR" ] || echo "==> mounting $candidate (the VM's path for $SCRIPT_DIR)"
      return 0
    fi
    tried="$tried  $candidate\n"
  done < <(mount_candidates)

  echo "error: this directory is not reachable from inside the VM." >&2
  printf "  tried:\n$tried" >&2
  echo "  colima shares a fixed set of paths, chosen when the VM is created," >&2
  echo "  so a path outside them mounts as an empty directory rather than" >&2
  echo "  failing. Look at what the VM actually has:" >&2
  echo "    colima ssh --profile $_profile -- ls /" >&2
  echo "  If the tree is there under another root, set HORTVAL_REPO_MAC and" >&2
  echo "  HORTVAL_REPO_VM to the two matching prefixes and re-run. If it is" >&2
  echo "  genuinely unshared, recreate the VM — note that deleting it also" >&2
  echo "  discards every image already pulled:" >&2
  echo "    colima delete $_profile && colima start --profile $_profile --mount \"$SCRIPT_DIR:w\"" >&2
  exit 1
}

docker_npm() {
  $HORTVAL_DOCKER run --rm $(tty_flags) --init \
    $(host_user_flag) \
    -v "$MOUNT_DIR:/app" \
    -v "$MODULES_VOLUME:/app/node_modules" \
    -w /app \
    -p "$PORT:3000" \
    -e HOME=/tmp \
    "$NODE_IMAGE" npm "$@"
}

run_npm() {
  if [ "$MODE" = local ]; then npm "$@"; else docker_npm "$@"; fi
}

# In docker mode node_modules is a volume the host cannot inspect, so "is it
# installed?" has to be asked inside the container. Answering it here means
# `./run.sh dev` works on a fresh clone instead of failing on a missing binary.
ensure_deps() {
  if [ "$MODE" = local ]; then
    [ -d node_modules ] || npm ci
    return
  fi
  if ! $HORTVAL_DOCKER run --rm \
       -v "$MOUNT_DIR:/app" -v "$MODULES_VOLUME:/app/node_modules" -w /app \
       "$NODE_IMAGE" test -d node_modules/@docusaurus/core 2>/dev/null; then
    echo "==> installing dependencies into volume $MODULES_VOLUME"
    docker_npm ci
  fi
}

case "${1:-build}" in
  build)
    [ "$MODE" = docker ] && assert_docker_ready
    ensure_deps
    echo "==> building the documentation site ($MODE)"
    run_npm run build
    ;;
  dev|start)
    [ "$MODE" = docker ] && assert_docker_ready
    ensure_deps
    echo "==> dev server on http://localhost:$PORT ($MODE)"
    # --host 0.0.0.0 so the published port reaches the server; the default
    # binds to the container's loopback, where nothing outside can see it.
    run_npm start -- --host 0.0.0.0 --port 3000
    ;;
  serve)
    [ "$MODE" = docker ] && assert_docker_ready
    ensure_deps
    echo "==> serving the built site on http://localhost:$PORT ($MODE)"
    run_npm run serve -- --host 0.0.0.0 --port 3000
    ;;
  install)
    [ "$MODE" = docker ] && assert_docker_ready
    echo "==> installing dependencies ($MODE)"
    run_npm ci
    ;;
  npm)
    shift
    [ "$MODE" = docker ] && assert_docker_ready
    run_npm "$@"
    ;;
  -h|--help|help)
    # Print the header block itself, stopping at the first non-comment line.
    # A fixed line range would drift silently the next time the header is edited.
    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"
    ;;
  *)
    echo "unknown mode: $1" >&2
    echo "usage: $0 [build|dev|serve|install|npm <args...>]" >&2
    exit 1
    ;;
esac
