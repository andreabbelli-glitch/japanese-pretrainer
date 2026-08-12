#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
PROJECT="$ROOT/DailyKanji.xcodeproj"
DERIVED_DATA="${DERIVED_DATA:-$ROOT/build/WifiRenewDerivedData}"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
PROFILE_STATE_FILE="${PROFILE_STATE_FILE:-$STATE_DIR/profile-state.env}"
SCHEME="${SCHEME:-DailyKanji}"
CONFIGURATION="${CONFIGURATION:-Release}"
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"

COREDEVICE_RECOVERY_HELPER="${COREDEVICE_RECOVERY_HELPER:-$ROOT/scripts/coredevice-recovery.sh}"
# shellcheck source=coredevice-recovery.sh
. "$COREDEVICE_RECOVERY_HELPER"

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
CONFIG_ENABLE_APNS="$(config_value DAILY_KANJI_ENABLE_APNS || true)"
DAILY_KANJI_ENABLE_APNS="${DAILY_KANJI_ENABLE_APNS:-$CONFIG_ENABLE_APNS}"
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

case "${DAILY_KANJI_ENABLE_APNS:-}" in
  ""|0|false|FALSE|no|NO)
    DAILY_KANJI_ENABLE_APNS=0
    ;;
  1|true|TRUE|yes|YES)
    DAILY_KANJI_ENABLE_APNS=1
    ;;
  *)
    echo "DAILY_KANJI_ENABLE_APNS deve essere 1/true/yes oppure 0/false/no." >&2
    exit 1
    ;;
esac

if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ] || [ -n "${MOBILE_API_ENDPOINT:-}" ] || [ "$DAILY_KANJI_ENABLE_APNS" = "1" ]; then
  runtime_xcconfig="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-runtime.XXXXXX")"
  chmod 600 "$runtime_xcconfig"

  {
    printf "DAILY_KANJI_ENABLE_APNS = %s\n" "$DAILY_KANJI_ENABLE_APNS"

    if [ "$DAILY_KANJI_ENABLE_APNS" = "1" ]; then
      printf "CODE_SIGN_ENTITLEMENTS = DailyKanjiPush.entitlements\n"
    fi

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

if coredevice_recovery_validate_settings; then
  :
else
  exit "$?"
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

embedded_profile_metadata_for_file() {
  local profile_path="$1"
  local profile_plist
  local expiry_iso
  local expiry_epoch
  local profile_uuid
  local status

  if profile_plist="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-profile.XXXXXX")"; then
    :
  else
    status="$?"
    printf "Impossibile creare il file temporaneo per il provisioning profile (exit %s).\n" "$status" >&2
    return "$status"
  fi

  set +e
  security cms -D -i "$profile_path" > "$profile_plist"
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    rm -f "$profile_plist"
    printf "Impossibile leggere il provisioning profile embedded (exit %s): %s\n" "$status" "$profile_path" >&2
    return "$status"
  fi

  set +e
  expiry_iso="$(plutil -extract ExpirationDate raw -o - "$profile_plist")"
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    rm -f "$profile_plist"
    printf "Impossibile leggere ExpirationDate dal provisioning profile (exit %s): %s\n" "$status" "$profile_path" >&2
    return "$status"
  fi

  set +e
  profile_uuid="$(plutil -extract UUID raw -o - "$profile_plist")"
  status=$?
  set -e
  rm -f "$profile_plist"
  if [ "$status" -ne 0 ]; then
    printf "Impossibile leggere UUID dal provisioning profile (exit %s): %s\n" "$status" "$profile_path" >&2
    return "$status"
  fi

  if [[ ! "$profile_uuid" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]]; then
    printf "UUID provisioning profile non valido per %s: %s\n" "$profile_path" "$profile_uuid" >&2
    return 65
  fi
  profile_uuid="$(printf "%s" "$profile_uuid" | tr '[:upper:]' '[:lower:]')"

  set +e
  expiry_epoch="$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$expiry_iso" +%s)"
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    printf "ExpirationDate non parsabile (exit %s) per %s: %s\n" "$status" "$profile_path" "$expiry_iso" >&2
    return "$status"
  fi

  printf "%s\t%s\n" "$expiry_epoch" "$profile_uuid"
}

record_embedded_profile_state() {
  local app_path="$1"
  local profile_count=0
  local min_expiry=""
  local -a profile_uuids=()
  local profile_path
  local metadata
  local expiry_epoch
  local profile_uuid
  local existing_uuid
  local expiry_label
  local state_temp
  local status

  while IFS= read -r -d '' profile_path; do
    set +e
    metadata="$(embedded_profile_metadata_for_file "$profile_path")"
    status=$?
    set -e
    if [ "$status" -ne 0 ]; then
      return "$status"
    fi

    expiry_epoch="${metadata%%$'\t'*}"
    profile_uuid="${metadata#*$'\t'}"
    if [ "$expiry_epoch" = "$metadata" ] || [ -z "$profile_uuid" ]; then
      printf "Metadata provisioning profile incompleti: %s\n" "$profile_path" >&2
      return 65
    fi

    if [ "$profile_count" -gt 0 ]; then
      for existing_uuid in "${profile_uuids[@]}"; do
        if [ "$existing_uuid" = "$profile_uuid" ]; then
          printf "UUID provisioning profile duplicato in app e widget: %s\n" "$profile_uuid" >&2
          return 65
        fi
      done
    fi
    profile_uuids+=("$profile_uuid")

    if [ -z "$min_expiry" ] || [ "$expiry_epoch" -lt "$min_expiry" ]; then
      min_expiry="$expiry_epoch"
    fi

    profile_count=$(( profile_count + 1 ))
  done < <(find "$app_path" -name embedded.mobileprovision -print0)

  if [ "$profile_count" -ne 2 ]; then
    printf "Profili embedded non validi: trovati %s, attesi esattamente app e widget in %s\n" "$profile_count" "$app_path" >&2
    return 1
  fi

  if mkdir -p "$STATE_DIR" "$(dirname "$PROFILE_STATE_FILE")"; then
    :
  else
    status="$?"
    printf "Impossibile creare la directory stato Daily Kanji (exit %s): %s\n" "$status" "$STATE_DIR" >&2
    return "$status"
  fi
  if state_temp="$(mktemp "$PROFILE_STATE_FILE.XXXXXX")"; then
    :
  else
    status="$?"
    printf "Impossibile creare il file temporaneo dello stato profili (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if {
    printf "VERSION=1\n"
    printf "EXPIRY_EPOCH=%s\n" "$min_expiry"
    printf "%s\n" "${profile_uuids[@]}" | LC_ALL=C sort | sed 's/^/PROFILE_UUID=/'
  } > "$state_temp"; then
    :
  else
    status="$?"
    rm -f "$state_temp"
    printf "Impossibile scrivere lo stato profili (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if chmod 600 "$state_temp"; then
    :
  else
    status="$?"
    rm -f "$state_temp"
    printf "Impossibile proteggere lo stato profili (exit %s).\n" "$status" >&2
    return "$status"
  fi

  # Scadenza e UUID diventano visibili insieme: il rename di un singolo file
  # sostituisce lo snapshot precedente senza coppie di file intermedie.
  if mv "$state_temp" "$PROFILE_STATE_FILE"; then
    :
  else
    status="$?"
    rm -f "$state_temp"
    printf "Impossibile registrare atomicamente lo stato profili (exit %s).\n" "$status" >&2
    return "$status"
  fi

  expiry_label="$(date -r "$min_expiry" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null || printf "%s" "$min_expiry")"
  printf "Daily Kanji profile expiry recorded: %s (%s)\n" "$min_expiry" "$expiry_label"
  printf "Daily Kanji embedded profile UUIDs recorded: %s\n" "${#profile_uuids[@]}"
}

developer_disk_image_ready() {
  local output
  local status

  if coredevice_run_with_recovery "developer disk image preflight" \
    xcrun devicectl device info ddiServices \
    --device "$DEVICE_ID" \
    --auto-mount-ddis \
    --timeout "$DDI_MOUNT_TIMEOUT_SECONDS"; then
    printf "Daily Kanji developer disk image services ready.\n"
    return 0
  fi
  status="$COREDEVICE_LAST_STATUS"
  output="$COREDEVICE_LAST_OUTPUT"

  if [[ "$output" == *"kAMDMobileImageMounterDeviceLocked"* ]] ||
    [[ "$output" == *"device is locked"* ]] ||
    [[ "$output" == *"The device is locked"* ]]; then
    printf "Daily Kanji iPhone bloccato: sblocca l'iPhone e lascialo acceso, poi rilancia il rinnovo (DDI exit %s).\n" "$status" >&2
    printf "%s\n" "$output" >&2
    return "$status"
  fi

  printf "Daily Kanji developer disk image non pronta; CoreDevice/DDI exited %s.\n" "$status" >&2
  printf "%s\n" "$output" >&2
  return "$status"
}

if coredevice_run_with_recovery "device reachability" \
  xcrun devicectl device info details \
  --device "$DEVICE_ID" \
  --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS"; then
  device_details="$COREDEVICE_LAST_OUTPUT"
else
  device_details_status="$COREDEVICE_LAST_STATUS"
  device_details="$COREDEVICE_LAST_OUTPUT"
  echo "Device $DEVICE_ID non raggiungibile da CoreDevice (exit $device_details_status)." >&2
  if [ -n "$device_details" ]; then
    printf "%s\n" "$device_details" >&2
  fi
  echo "Metti iPhone e Mac sulla stessa Wi-Fi oppure collega il cavo." >&2
  exit "$device_details_status"
fi

transport="$(printf "%s\n" "$device_details" | awk -F': ' '/transportType/ {print $2; exit}')"

if [ -z "$transport" ]; then
  echo "Device $DEVICE_ID non raggiungibile da CoreDevice." >&2
  echo "Metti iPhone e Mac sulla stessa Wi-Fi oppure collega il cavo." >&2
  exit 1
fi

printf "Device raggiunto via: %s\n" "$transport"
if developer_disk_image_ready; then
  :
else
  exit "$?"
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

if [ "$DAILY_KANJI_ENABLE_APNS" = "1" ]; then
  printf "Daily Kanji APNs entitlement: abilitato\n"
else
  printf "Daily Kanji APNs entitlement: disabilitato per build Personal Team\n"
fi

cd "$ROOT"
if "$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:verify-resources -- --ios-root "$ROOT"; then
  :
else
  status="$?"
  printf "Daily Kanji resource verification failed with exit %s.\n" "$status" >&2
  exit "$status"
fi
if xcodegen generate; then
  :
else
  status="$?"
  printf "Daily Kanji xcodegen failed with exit %s.\n" "$status" >&2
  exit "$status"
fi

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

if coredevice_run_with_recovery "device install" \
  xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"; then
  if [ -n "$COREDEVICE_LAST_OUTPUT" ]; then
    printf "%s\n" "$COREDEVICE_LAST_OUTPUT"
  fi
else
  install_status="$COREDEVICE_LAST_STATUS"
  if [ -n "$COREDEVICE_LAST_OUTPUT" ]; then
    printf "%s\n" "$COREDEVICE_LAST_OUTPUT" >&2
  fi
  printf "Daily Kanji device install failed with exit %s.\n" "$install_status" >&2
  exit "$install_status"
fi
if record_embedded_profile_state "$APP_PATH"; then
  :
else
  profile_status="$?"
  printf "Daily Kanji profile expiry recording failed with exit %s.\n" "$profile_status" >&2
  exit "$profile_status"
fi

printf "Rinnovo/install completato: %s\n" "$APP_PATH"
