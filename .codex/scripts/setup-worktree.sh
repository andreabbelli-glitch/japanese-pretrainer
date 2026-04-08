#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLAYWRIGHT_CACHE_DIR="${HOME}/Library/Caches/ms-playwright"

cd "$ROOT_DIR"

echo "==> Installing project dependencies"
./scripts/with-node.sh pnpm install --frozen-lockfile

if ! find "$PLAYWRIGHT_CACHE_DIR" -maxdepth 1 -type d \
  \( -name 'chromium-*' -o -name 'firefox-*' -o -name 'webkit-*' \) | grep -q .; then
  echo "==> Playwright browsers missing in ${PLAYWRIGHT_CACHE_DIR}"
  echo "==> Installing Playwright browsers"
  ./scripts/with-node.sh pnpm exec playwright install chromium firefox webkit
fi

echo "==> Verifying local toolchain"
./scripts/tooling-doctor.sh
