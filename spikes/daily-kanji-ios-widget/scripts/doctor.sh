#!/usr/bin/env bash
set -euo pipefail

failures=0

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

check_command() {
  local name="$1"
  local hint="$2"

  if command -v "$name" >/dev/null 2>&1; then
    printf "ok   %s: %s\n" "$name" "$(command -v "$name")"
  else
    printf "miss %s: %s\n" "$name" "$hint"
    failures=$((failures + 1))
  fi
}

check_path() {
  local label="$1"
  local path="$2"
  local hint="$3"

  if [ -e "$path" ]; then
    printf "ok   %s: %s\n" "$label" "$path"
  else
    printf "miss %s: %s\n" "$label" "$hint"
    failures=$((failures + 1))
  fi
}

check_command xcodegen "brew install xcodegen"
check_command ditto "ditto e' incluso in macOS"
check_path Xcode.app /Applications/Xcode.app "install Xcode da App Store o Apple Developer Downloads"
check_path Sideloadly.app /Applications/Sideloadly.app "install Sideloadly se vuoi testare auto-refresh gratuito"

if command -v xcode-select >/dev/null 2>&1; then
  developer_dir="$(xcode-select -p 2>/dev/null || true)"
  printf "info xcode-select: %s\n" "$developer_dir"

  if [[ "${DEVELOPER_DIR:-}" == "/Applications/Xcode.app/Contents/Developer" ]]; then
    printf "ok   DEVELOPER_DIR: %s\n" "$DEVELOPER_DIR"
  elif [[ "$developer_dir" == "/Applications/Xcode.app/Contents/Developer" ]]; then
    printf "ok   active developer dir: full Xcode\n"
  else
    printf "miss active developer dir: export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer or sudo xcode-select -s /Applications/Xcode.app/Contents/Developer\n"
    failures=$((failures + 1))
  fi
fi

if command -v xcodebuild >/dev/null 2>&1 && xcodebuild -version >/dev/null 2>&1; then
  printf "ok   xcodebuild: %s\n" "$(xcodebuild -version | head -n 1)"
else
  printf "miss xcodebuild: install Xcode completo e selezionalo con xcode-select\n"
  failures=$((failures + 1))
fi

if xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
  printf "ok   iphoneos SDK: %s\n" "$(xcrun --sdk iphoneos --show-sdk-path)"
else
  printf "miss iphoneos SDK: Xcode completo deve includere la piattaforma iOS\n"
  failures=$((failures + 1))
fi

if xcrun --sdk iphonesimulator --show-sdk-path >/dev/null 2>&1; then
  printf "ok   iphonesimulator SDK: %s\n" "$(xcrun --sdk iphonesimulator --show-sdk-path)"
else
  printf "miss iphonesimulator SDK: installa i componenti iOS da Xcode se richiesto al primo avvio\n"
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  printf "\n%d prerequisiti mancanti. Lo spike non e' ancora buildabile su questo Mac.\n" "$failures"
  exit 1
fi

printf "\nPrerequisiti locali presenti. Puoi generare il progetto con: xcodegen generate\n"
