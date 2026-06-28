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
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"

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
DEVICE_ID="${DEVICE_ID:-$CONFIG_DEVICE_ID}"
CONFIG_SYNC_ENDPOINT="$(config_value DAILY_KANJI_IOS_SYNC_ENDPOINT || true)"
CONFIG_SYNC_TOKEN="$(config_value DAILY_KANJI_IOS_SYNC_TOKEN || true)"
DAILY_KANJI_IOS_SYNC_ENDPOINT="${DAILY_KANJI_IOS_SYNC_ENDPOINT:-$CONFIG_SYNC_ENDPOINT}"
DAILY_KANJI_IOS_SYNC_TOKEN="${DAILY_KANJI_IOS_SYNC_TOKEN:-$CONFIG_SYNC_TOKEN}"
CONFIG_MOBILE_API_ENDPOINT="$(config_value MOBILE_API_ENDPOINT || true)"
CONFIG_MOBILE_API_TOKEN="$(config_value MOBILE_API_TOKEN || true)"
MOBILE_API_ENDPOINT="${MOBILE_API_ENDPOINT:-$CONFIG_MOBILE_API_ENDPOINT}"
MOBILE_API_TOKEN="${MOBILE_API_TOKEN:-$CONFIG_MOBILE_API_TOKEN}"
runtime_xcconfig=""
runtime_xcconfig_args=()
xcodebuild_args=()

cleanup_runtime_xcconfig() {
  if [ -n "$runtime_xcconfig" ] && [ -f "$runtime_xcconfig" ]; then
    rm -f "$runtime_xcconfig"
  fi
}

trap cleanup_runtime_xcconfig EXIT

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
fi

if [ -n "${MOBILE_API_ENDPOINT:-}" ] || [ -n "${MOBILE_API_TOKEN:-}" ]; then
  if [ -z "${MOBILE_API_ENDPOINT:-}" ] || [ -z "${MOBILE_API_TOKEN:-}" ]; then
    echo "MOBILE_API_ENDPOINT e MOBILE_API_TOKEN devono essere configurati insieme." >&2
    exit 1
  fi

  validate_xcconfig_value MOBILE_API_ENDPOINT "$MOBILE_API_ENDPOINT"
  validate_xcconfig_value MOBILE_API_TOKEN "$MOBILE_API_TOKEN"
fi

if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ] || [ -n "${MOBILE_API_ENDPOINT:-}" ]; then
  runtime_xcconfig="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-runtime.XXXXXX")"
  chmod 600 "$runtime_xcconfig"

  {
    if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ]; then
      printf "DAILY_KANJI_IOS_SYNC_ENDPOINT = %s\n" "$(xcconfig_value "$DAILY_KANJI_IOS_SYNC_ENDPOINT")"
      printf "DAILY_KANJI_IOS_SYNC_TOKEN = %s\n" "$(xcconfig_value "$DAILY_KANJI_IOS_SYNC_TOKEN")"
    fi

    if [ -n "${MOBILE_API_ENDPOINT:-}" ]; then
      printf "MOBILE_API_ENDPOINT = %s\n" "$(xcconfig_value "$MOBILE_API_ENDPOINT")"
      printf "MOBILE_API_TOKEN = %s\n" "$(xcconfig_value "$MOBILE_API_TOKEN")"
    fi
  } > "$runtime_xcconfig"
  runtime_xcconfig_args=("-xcconfig" "$runtime_xcconfig")
fi

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if [ -z "${DEVICE_ID:-}" ]; then
  echo "DEVICE_ID non configurato. Imposta DEVICE_ID oppure installa l'automazione con scripts/install-renew-launchd.sh --device-id <coredevice-id-or-udid>." >&2
  exit 2
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild non trovato. Installa Xcode completo." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen non trovato. Installa con: brew install xcodegen" >&2
  exit 1
fi

print_xcodebuild_failure_hint() {
  local output="$1"

  if [[ "$output" == *"No Accounts"* ]] ||
    [[ "$output" == *"No profiles"* ]] ||
    [[ "$output" == *"provisioning profile"* ]] ||
    [[ "$output" == *"Provisioning profile"* ]] ||
    [[ "$output" == *"Signing for"* ]] ||
    [[ "$output" == *"requires a development team"* ]]; then
    cat >&2 <<'HINT'

Daily Kanji signing/provisioning non pronto.
- Apri Xcode Settings > Accounts e verifica che il Personal Team sia loggato.
- Apri apps/daily-kanji-ios/DailyKanji.xcodeproj e lascia Xcode rigenerare i provisioning profile.
- Controlla che il DEVELOPMENT_TEAM in project.yml corrisponda al team dell'account Apple Development installato.
- I bundle id da firmare sono dev.local.daily-kanji e dev.local.daily-kanji.widget.
- Dopo il refresh dei profili, rilancia scripts/xcode-renew.sh o scripts/xcode-renew-if-needed.sh --force.
HINT
  fi
}

developer_disk_image_ready() {
  local output

  if output="$(xcrun devicectl device info ddiServices \
    --device "$DEVICE_ID" \
    --auto-mount-ddis \
    --timeout "$DDI_MOUNT_TIMEOUT_SECONDS" 2>&1)"; then
    printf "Daily Kanji developer disk image services ready.\n"
    return 0
  fi

  if [[ "$output" == *"kAMDMobileImageMounterDeviceLocked"* ]] ||
    [[ "$output" == *"device is locked"* ]] ||
    [[ "$output" == *"The device is locked"* ]]; then
    printf "Daily Kanji iPhone bloccato: sblocca l'iPhone e lascialo acceso, poi rilancia il rinnovo.\n"
    printf "%s\n" "$output"
    return 1
  fi

  printf "Daily Kanji developer disk image non pronta; correggi CoreDevice/DDI e rilancia il rinnovo.\n"
  printf "%s\n" "$output"
  return 1
}

if ! device_details="$(xcrun devicectl device info details \
  --device "$DEVICE_ID" \
  --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS" 2>/dev/null)"; then
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
if ! developer_disk_image_ready; then
  exit 75
fi

if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ]; then
  printf "Daily Kanji dataset sync: configurato\n"
else
  printf "Daily Kanji dataset sync: non configurato, uso fallback packaged/cache\n"
fi

if [ -n "${MOBILE_API_ENDPOINT:-}" ]; then
  printf "Daily Kanji live review API: configurata\n"
else
  printf "Daily Kanji live review API: non configurata\n"
fi

cd "$ROOT"
"$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:verify-resources -- --ios-root "$ROOT"
xcodegen generate

xcodebuild_args=(
  -quiet
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates
)

if [ "${#runtime_xcconfig_args[@]}" -gt 0 ]; then
  xcodebuild_args+=("${runtime_xcconfig_args[@]}")
fi

xcodebuild_args+=(build)

set +e
xcodebuild_output="$(xcodebuild "${xcodebuild_args[@]}" 2>&1)"
xcodebuild_status=$?
set -e

if [ "$xcodebuild_status" -ne 0 ]; then
  printf "%s\n" "$xcodebuild_output" >&2
  print_xcodebuild_failure_hint "$xcodebuild_output"
  exit "$xcodebuild_status"
fi

APP_PATH="$DERIVED_DATA/Build/Products/$CONFIGURATION-iphoneos/Daily Kanji.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Build completata ma app non trovata: $APP_PATH" >&2
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

printf "Rinnovo/install completato: %s\n" "$APP_PATH"
