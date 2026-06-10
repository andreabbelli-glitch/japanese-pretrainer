#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/DailyKanjiWidgetSpike.xcodeproj"
DERIVED_DATA="$ROOT/build/DerivedData"
IPA_ROOT="$ROOT/build/ipa"
IPA_PATH="$ROOT/build/DailyKanjiWidgetSpike.ipa"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild non trovato. Installa Xcode completo e selezionalo con xcode-select." >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "xcodebuild non e' utilizzabile. Installa Xcode completo e selezionalo con:" >&2
  echo "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen non trovato. Installa con: brew install xcodegen" >&2
  exit 1
fi

cd "$ROOT"
xcodegen generate

rm -rf "$DERIVED_DATA" "$IPA_ROOT" "$IPA_PATH"

xcodebuild \
  -project "$PROJECT" \
  -scheme DailyKanjiWidgetSpike \
  -configuration Debug \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

APP_PATH="$(find "$DERIVED_DATA/Build/Products/Debug-iphoneos" -maxdepth 1 -name "*.app" -type d -print -quit)"

if [ -z "$APP_PATH" ]; then
  echo "Build completata ma .app non trovato in $DERIVED_DATA/Build/Products/Debug-iphoneos" >&2
  exit 1
fi

mkdir -p "$IPA_ROOT/Payload"
cp -R "$APP_PATH" "$IPA_ROOT/Payload/"

(cd "$IPA_ROOT" && ditto -c -k --sequesterRsrc --keepParent Payload "$IPA_PATH")

printf "IPA pronta: %s\n" "$IPA_PATH"
