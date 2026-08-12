#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/DailyKanji.xcodeproj"
CONFIGURATION="${DAILY_KANJI_IOS_TEST_CONFIGURATION:-Debug}"
DESTINATION="${DAILY_KANJI_IOS_TEST_DESTINATION:-platform=iOS Simulator,name=iPhone 17}"
DERIVED_DATA_PATH="${DAILY_KANJI_IOS_TEST_DERIVED_DATA_PATH:-$ROOT/build/SimulatorDerivedData}"

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen non trovato. Installa con: brew install xcodegen" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild non trovato. Installa Xcode completo e selezionalo con xcode-select." >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "xcodebuild non e' utilizzabile. Installa Xcode completo e selezionalo con:" >&2
  echo "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

cd "$ROOT"

printf "Daily Kanji iOS test destination: %s\n" "$DESTINATION"
printf "Daily Kanji iOS DerivedData (reused): %s\n" "$DERIVED_DATA_PATH"

xcodegen generate

xcodebuild \
  -project "$PROJECT" \
  -scheme DailyKanji \
  -configuration "$CONFIGURATION" \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  test
