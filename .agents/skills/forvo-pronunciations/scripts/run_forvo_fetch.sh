#!/usr/bin/env bash
set -euo pipefail

find_repo_root() {
  local dir="$1"

  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" && -f "$dir/scripts/with-node.sh" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi

    dir="$(dirname "$dir")"
  done

  return 1
}

REPO_ROOT=""

if [[ -n "${JAPANESE_CUSTOM_STUDY_ROOT:-}" ]]; then
  REPO_ROOT="$(find_repo_root "$JAPANESE_CUSTOM_STUDY_ROOT" || true)"
fi

if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(find_repo_root "$PWD" || true)"
fi

if [[ -z "$REPO_ROOT" ]]; then
  for candidate in \
    "/Users/abelli/Codex/Japanese Custom Study" \
    "/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study"
  do
    REPO_ROOT="$(find_repo_root "$candidate" || true)"
    if [[ -n "$REPO_ROOT" ]]; then
      break
    fi
  done
fi

if [[ -z "$REPO_ROOT" ]]; then
  echo "Japanese Custom Study repo not found. Set JAPANESE_CUSTOM_STUDY_ROOT or run from inside the repo." >&2
  exit 1
fi

cd "$REPO_ROOT"

has_mode=0
args=("$@")
for arg in "${args[@]}"; do
  case "$arg" in
    --mode|--mode=*)
      has_mode=1
      ;;
  esac
done

if [[ "$has_mode" -eq 1 ]]; then
  ./scripts/with-node.sh pnpm pronunciations:resolve -- "${args[@]}"
else
  ./scripts/with-node.sh pnpm pronunciations:forvo -- --manual "${args[@]}"
fi
