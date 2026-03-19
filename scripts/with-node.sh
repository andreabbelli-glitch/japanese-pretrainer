#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ORIGINAL_NVM_DIR="${NVM_DIR:-}"
DEFAULT_NVM_DIR="$HOME/.nvm"
export NVM_DIR="${ORIGINAL_NVM_DIR:-$DEFAULT_NVM_DIR}"
NODE_VERSION="$(cat "$ROOT_DIR/.nvmrc")"
CURRENT_NODE_VERSION="$(node --version 2>/dev/null || true)"

# Some tooling sets FORCE_COLOR while the shell exports NO_COLOR.
# Node warns and then ignores NO_COLOR anyway, so normalize the env first.
if [[ -n "${FORCE_COLOR:-}" && -n "${NO_COLOR:-}" ]]; then
  unset NO_COLOR
fi

if [[ "$CURRENT_NODE_VERSION" == "v$NODE_VERSION" ]]; then
  exec "$@"
fi

NVM_SCRIPT_CANDIDATES=(
  "$NVM_DIR/nvm.sh"
  "$DEFAULT_NVM_DIR/nvm.sh"
  "/opt/homebrew/opt/nvm/nvm.sh"
  "/usr/local/opt/nvm/nvm.sh"
)

NVM_DATA_CANDIDATES=(
  "$NVM_DIR"
  "$DEFAULT_NVM_DIR"
)

for NVM_SH in "${NVM_SCRIPT_CANDIDATES[@]}"; do
  if [[ ! -s "$NVM_SH" ]]; then
    continue
  fi

  for NVM_DATA_DIR in "${NVM_DATA_CANDIDATES[@]}"; do
    if [[ -z "$NVM_DATA_DIR" ]]; then
      continue
    fi

    export NVM_DIR="$NVM_DATA_DIR"
    # shellcheck source=/dev/null
    . "$NVM_SH" --no-use

    if nvm use --silent "$NODE_VERSION" >/dev/null 2>&1; then
      exec "$@"
    fi
  done
done

echo "Unable to activate Node $NODE_VERSION." >&2
echo "Set NVM_DIR correctly, install nvm, or run the command with Node $NODE_VERSION already active." >&2
exit 1
