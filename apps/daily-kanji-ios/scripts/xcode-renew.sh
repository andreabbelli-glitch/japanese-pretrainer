#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
PROJECT="$ROOT/DailyKanji.xcodeproj"
DERIVED_DATA="${DERIVED_DATA:-$ROOT/build/WifiRenewDerivedData}"
DEVICE_ID="${DEVICE_ID:-D584E119-3362-5913-B704-DE927F58EF18}"
SCHEME="${SCHEME:-DailyKanji}"
CONFIGURATION="${CONFIGURATION:-Debug}"

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild non trovato. Installa Xcode completo." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen non trovato. Installa con: brew install xcodegen" >&2
  exit 1
fi

cd "$ROOT"
"$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:verify-resources -- --ios-root "$ROOT"
xcodegen generate

if ! device_details="$(xcrun devicectl device info details --device "$DEVICE_ID" 2>/dev/null)"; then
  echo "Device $DEVICE_ID non raggiungibile da CoreDevice." >&2
  echo "Metti iPhone e Mac sulla stessa Wi-Fi oppure collega il cavo." >&2
  exit 1
fi

transport="$(printf "%s\n" "$device_details" | awk -F': ' '/transportType/ {print $2; exit}')"

if [ -z "$transport" ]; then
  echo "Device $DEVICE_ID non raggiungibile da CoreDevice." >&2
  echo "Metti iPhone e Mac sulla stessa Wi-Fi oppure collega il cavo." >&2
  exit 1
fi

printf "Device raggiunto via: %s\n" "$transport"

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  build

APP_PATH="$DERIVED_DATA/Build/Products/$CONFIGURATION-iphoneos/Daily Kanji.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Build completata ma app non trovata: $APP_PATH" >&2
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

printf "Rinnovo/install completato: %s\n" "$APP_PATH"
