#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NVM_SH="/opt/homebrew/opt/nvm/nvm.sh"
NODE_VERSION="$(cat "$(dirname "$0")/../.nvmrc")"

if [[ ! -s "$NVM_SH" ]]; then
  echo "nvm init script not found at $NVM_SH" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$NVM_SH"
nvm use --silent "$NODE_VERSION" >/dev/null

exec "$@"
