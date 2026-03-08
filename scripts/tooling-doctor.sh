#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Repository: $ROOT_DIR"
"$ROOT_DIR/scripts/with-node.sh" node --version
"$ROOT_DIR/scripts/with-node.sh" pnpm --version
sqlite3 --version
python3 --version
git --version
rg --version | head -n 1

PLAYWRIGHT_DIR="$HOME/Library/Caches/ms-playwright"
if [[ -d "$PLAYWRIGHT_DIR" ]]; then
  echo "Playwright cache: $PLAYWRIGHT_DIR"
  find "$PLAYWRIGHT_DIR" -maxdepth 1 -type d \( -name 'chromium-*' -o -name 'firefox-*' -o -name 'webkit-*' \) | sort
else
  echo "Playwright cache not found: $PLAYWRIGHT_DIR"
fi
