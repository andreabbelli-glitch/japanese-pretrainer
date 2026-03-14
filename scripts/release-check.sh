#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

cd "$ROOT_DIR"

run_step "Lint, typecheck e test unit/integration" \
  ./scripts/with-node.sh pnpm check

run_step "Build di produzione" \
  ./scripts/with-node.sh pnpm build

run_step "Validazione contenuti sul bundle reale duel-masters-dm25" \
  ./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25

run_step "Test end-to-end" \
  ./scripts/with-node.sh pnpm test:e2e:runner

echo
echo "Release gate v1 locale completato con successo."
