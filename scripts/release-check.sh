#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_CHECK_DATABASE_URL="${RELEASE_CHECK_DATABASE_URL:-$ROOT_DIR/.tmp/release-check/japanese-custom-study-release.sqlite}"

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

run_with_release_database() {
  env \
    CONTENT_CACHE_REVALIDATE_SECRET= \
    CONTENT_CACHE_REVALIDATE_URL= \
    DATABASE_AUTH_TOKEN= \
    DATABASE_URL="$RELEASE_CHECK_DATABASE_URL" \
    E2E_DATABASE_URL="$RELEASE_CHECK_DATABASE_URL" \
    LIBSQL_AUTH_TOKEN= \
    "$@"
}

prepare_release_database() {
  mkdir -p "$(dirname "$RELEASE_CHECK_DATABASE_URL")"
  rm -f \
    "$RELEASE_CHECK_DATABASE_URL" \
    "$RELEASE_CHECK_DATABASE_URL-shm" \
    "$RELEASE_CHECK_DATABASE_URL-wal"

  run_with_release_database ./scripts/with-node.sh pnpm db:migrate
  echo "content:import completo: parse e validazione di tutti i bundle prima della sync."
  run_with_release_database ./scripts/with-node.sh pnpm content:import
}

cd "$ROOT_DIR"

run_step "Lint, typecheck e test unit/integration" \
  ./scripts/with-node.sh pnpm check

run_step "Preparazione DB SQLite + import completo validato per release" \
  prepare_release_database

run_step "Build di produzione" \
  run_with_release_database ./scripts/with-node.sh pnpm build

run_step "Validazione corpus Pitch Accent Minimal Pairs" \
  ./scripts/with-node.sh pnpm pitch-accent:validate-corpus

run_step "Validazione corpus Pitch Accent Tofugu" \
  ./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs

run_step "Test end-to-end" \
  run_with_release_database ./scripts/with-node.sh pnpm test:e2e:runner

echo
echo "Release gate v1 locale completato con successo."
