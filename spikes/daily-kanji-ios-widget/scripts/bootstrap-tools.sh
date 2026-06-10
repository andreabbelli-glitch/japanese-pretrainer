#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOWNLOAD_DIR="$ROOT/../../.tmp/ios-spike-downloads"
SIDELOADLY_DMG="$DOWNLOAD_DIR/SideloadlySetup.dmg"
SIDELOADLY_URL="https://sideloadly.io/SideloadlySetup.dmg"
SIDELOADLY_VOLUME="/Volumes/Sideloadly! v0.60 Setup"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew non trovato. Installa Homebrew prima di usare questo bootstrap." >&2
  exit 1
fi

brew install xcodegen mas xcodes aria2

mkdir -p "$DOWNLOAD_DIR"

if [ ! -f "$SIDELOADLY_DMG" ]; then
  curl -L --fail --show-error --progress-bar -o "$SIDELOADLY_DMG" "$SIDELOADLY_URL"
fi

if [ ! -d /Applications/Sideloadly.app ]; then
  hdiutil attach "$SIDELOADLY_DMG" -nobrowse -readonly
  trap 'hdiutil detach "$SIDELOADLY_VOLUME" >/dev/null 2>&1 || true' EXIT

  if [ ! -d "$SIDELOADLY_VOLUME/Sideloadly.app" ]; then
    echo "Sideloadly.app non trovato nel DMG montato." >&2
    exit 1
  fi

  cp -R "$SIDELOADLY_VOLUME/Sideloadly.app" /Applications/Sideloadly.app
fi

"$ROOT/scripts/doctor.sh"

