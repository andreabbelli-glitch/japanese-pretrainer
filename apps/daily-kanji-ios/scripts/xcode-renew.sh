#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
PROJECT="$ROOT/DailyKanji.xcodeproj"
DERIVED_DATA="${DERIVED_DATA:-$ROOT/build/WifiRenewDerivedData}"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
SCHEME="${SCHEME:-DailyKanji}"
CONFIGURATION="${CONFIGURATION:-Debug}"

config_value() {
  local key="$1"

  if [ ! -f "$CONFIG_FILE" ]; then
    return 1
  fi

  awk -F= -v key="$key" '$1 == key {
    sub(/^[^=]*=/, "")
    print
    exit
  }' "$CONFIG_FILE"
}

CONFIG_DEVICE_ID="$(config_value DEVICE_ID || true)"
DEVICE_ID="${DEVICE_ID:-${CONFIG_DEVICE_ID:-D584E119-3362-5913-B704-DE927F58EF18}}"
CONFIG_SYNC_ENDPOINT="$(config_value DAILY_KANJI_IOS_SYNC_ENDPOINT || true)"
CONFIG_SYNC_TOKEN="$(config_value DAILY_KANJI_IOS_SYNC_TOKEN || true)"
DAILY_KANJI_IOS_SYNC_ENDPOINT="${DAILY_KANJI_IOS_SYNC_ENDPOINT:-$CONFIG_SYNC_ENDPOINT}"
DAILY_KANJI_IOS_SYNC_TOKEN="${DAILY_KANJI_IOS_SYNC_TOKEN:-$CONFIG_SYNC_TOKEN}"
sync_xcconfig=""
sync_xcconfig_args=()

cleanup_sync_xcconfig() {
  if [ -n "$sync_xcconfig" ] && [ -f "$sync_xcconfig" ]; then
    rm -f "$sync_xcconfig"
  fi
}

trap cleanup_sync_xcconfig EXIT

validate_xcconfig_value() {
  local label="$1"
  local value="$2"

  case "$value" in
    *$'\n'*|*$'\r'*)
      echo "$label non puo contenere newline." >&2
      exit 1
      ;;
  esac
}

xcconfig_value() {
  printf "%s" "$1" | sed 's#//#/$()/#g'
}

if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ] || [ -n "${DAILY_KANJI_IOS_SYNC_TOKEN:-}" ]; then
  if [ -z "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ] || [ -z "${DAILY_KANJI_IOS_SYNC_TOKEN:-}" ]; then
    echo "DAILY_KANJI_IOS_SYNC_ENDPOINT e DAILY_KANJI_IOS_SYNC_TOKEN devono essere configurati insieme." >&2
    exit 1
  fi

  validate_xcconfig_value DAILY_KANJI_IOS_SYNC_ENDPOINT "$DAILY_KANJI_IOS_SYNC_ENDPOINT"
  validate_xcconfig_value DAILY_KANJI_IOS_SYNC_TOKEN "$DAILY_KANJI_IOS_SYNC_TOKEN"

  sync_xcconfig="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-sync.XXXXXX")"
  chmod 600 "$sync_xcconfig"
  {
    printf "DAILY_KANJI_IOS_SYNC_ENDPOINT = %s\n" "$(xcconfig_value "$DAILY_KANJI_IOS_SYNC_ENDPOINT")"
    printf "DAILY_KANJI_IOS_SYNC_TOKEN = %s\n" "$(xcconfig_value "$DAILY_KANJI_IOS_SYNC_TOKEN")"
  } > "$sync_xcconfig"
  sync_xcconfig_args=("-xcconfig" "$sync_xcconfig")
fi

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
if [ "${#sync_xcconfig_args[@]}" -gt 0 ]; then
  printf "Daily Kanji runtime sync: configurato\n"
else
  printf "Daily Kanji runtime sync: non configurato, uso fallback packaged/cache\n"
fi

xcodebuild \
  -quiet \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  "${sync_xcconfig_args[@]}" \
  build

APP_PATH="$DERIVED_DATA/Build/Products/$CONFIGURATION-iphoneos/Daily Kanji.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Build completata ma app non trovata: $APP_PATH" >&2
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

printf "Rinnovo/install completato: %s\n" "$APP_PATH"
