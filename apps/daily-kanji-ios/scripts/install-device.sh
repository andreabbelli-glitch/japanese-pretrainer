#!/usr/bin/env bash
set -euo pipefail
umask 077
set +a

incoming_device_id="${DEVICE_ID-}"
incoming_sync_endpoint="${DAILY_KANJI_IOS_SYNC_ENDPOINT-}"
incoming_sync_token="${DAILY_KANJI_IOS_SYNC_TOKEN-}"
incoming_mobile_endpoint="${MOBILE_API_ENDPOINT-}"
incoming_mobile_token="${MOBILE_API_TOKEN-}"
incoming_enable_apns="${DAILY_KANJI_ENABLE_APNS-}"
export -n DEVICE_ID DAILY_KANJI_IOS_SYNC_ENDPOINT DAILY_KANJI_IOS_SYNC_TOKEN \
  MOBILE_API_ENDPOINT MOBILE_API_TOKEN DAILY_KANJI_ENABLE_APNS COREDEVICE_ID \
  PROFILE_DEVICE_ID DEVICE_NAME 2>/dev/null || true
unset COREDEVICE_ID PROFILE_DEVICE_ID DEVICE_NAME

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
PROJECT="$ROOT/DailyKanji.xcodeproj"
DERIVED_DATA="${DERIVED_DATA:-$ROOT/build/DeviceInstallDerivedData}"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
DEVICE_CONFIG_FILE="${DEVICE_CONFIG_FILE:-$STATE_DIR/device.env}"
SCHEME="DailyKanji"
CONFIGURATION="Release"
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"
MIN_PROFILE_VALIDITY_SECONDS=2592000
DEVELOPMENT_TEAM="F5U46464YH"
APP_IDENTIFIER="$DEVELOPMENT_TEAM.dev.local.daily-kanji"
WIDGET_IDENTIFIER="$DEVELOPMENT_TEAM.dev.local.daily-kanji.widget"
runtime_xcconfig=""
runtime_xcconfig_args=()
device_list_json=""
device_details_json=""

config_value() {
  local key="$1"

  if [ ! -f "$DEVICE_CONFIG_FILE" ]; then
    return 1
  fi

  awk -F= -v key="$key" '$1 == key {
    sub(/^[^=]*=/, "")
    sub(/\r$/, "")
    print
    exit
  }' "$DEVICE_CONFIG_FILE"
}

validate_device_config_file() {
  local config_mode
  local config_owner

  if [ ! -e "$DEVICE_CONFIG_FILE" ] && [ ! -L "$DEVICE_CONFIG_FILE" ]; then
    return 0
  fi
  if [ ! -f "$DEVICE_CONFIG_FILE" ] || [ -L "$DEVICE_CONFIG_FILE" ]; then
    echo "Configurazione device non valida: atteso un file regolare non simbolico." >&2
    return 1
  fi

  config_owner="$(stat -f "%u" "$DEVICE_CONFIG_FILE")"
  if [ "$config_owner" != "$(id -u)" ]; then
    echo "Configurazione device non valida: il file deve appartenere all'utente corrente." >&2
    return 1
  fi

  config_mode="$(stat -f "%Lp" "$DEVICE_CONFIG_FILE")"
  if [ "$config_mode" != "600" ]; then
    echo "Configurazione device non protetta: imposta permessi 0600 su $DEVICE_CONFIG_FILE." >&2
    return 1
  fi
}

prepare_private_derived_data() {
  local derived_data_mode
  local derived_data_owner

  if [ -e "$DERIVED_DATA" ] || [ -L "$DERIVED_DATA" ]; then
    if [ ! -d "$DERIVED_DATA" ] || [ -L "$DERIVED_DATA" ]; then
      echo "DerivedData non valida: attesa una directory reale e privata." >&2
      return 1
    fi
    derived_data_owner="$(stat -f "%u" "$DERIVED_DATA")"
    if [ "$derived_data_owner" != "$(id -u)" ]; then
      echo "DerivedData non valida: la directory deve appartenere all'utente corrente." >&2
      return 1
    fi
  else
    mkdir -p "$DERIVED_DATA"
  fi

  chmod 700 "$DERIVED_DATA"
  derived_data_mode="$(stat -f "%Lp" "$DERIVED_DATA")"
  if [ "$derived_data_mode" != "700" ]; then
    echo "DerivedData non protetta: impossibile applicare i permessi 0700." >&2
    return 1
  fi
}

cleanup_temp_files() {
  if [ -n "$runtime_xcconfig" ] && [ -f "$runtime_xcconfig" ]; then
    rm -f "$runtime_xcconfig"
  fi
  if [ -n "$device_list_json" ] && [ -f "$device_list_json" ]; then
    rm -f "$device_list_json"
  fi
  if [ -n "$device_details_json" ] && [ -f "$device_details_json" ]; then
    rm -f "$device_details_json"
  fi
}

trap cleanup_temp_files EXIT

redact_private_values() {
  local redacted="$1"
  local private_value
  local xcconfig_endpoint

  for private_value in \
    "${DEVICE_ID:-}" \
    "${COREDEVICE_ID:-}" \
    "${PROFILE_DEVICE_ID:-}" \
    "${DEVICE_NAME:-}" \
    "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" \
    "${DAILY_KANJI_IOS_SYNC_TOKEN:-}" \
    "${MOBILE_API_ENDPOINT:-}" \
    "${MOBILE_API_TOKEN:-}"; do
    if [ -n "$private_value" ]; then
      redacted="${redacted//"$private_value"/[private]}"
    fi
  done

  for private_value in \
    "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" \
    "${DAILY_KANJI_IOS_SYNC_TOKEN:-}" \
    "${MOBILE_API_ENDPOINT:-}" \
    "${MOBILE_API_TOKEN:-}"; do
    if [ -n "$private_value" ]; then
      xcconfig_endpoint="$(xcconfig_value "$private_value")"
      redacted="${redacted//"$xcconfig_endpoint"/[private]}"
    fi
  done
  printf "%s\n" "$redacted"
}

run_private_device_command() {
  local failure_message="$1"
  local command_status
  shift

  set +e
  "$@" >/dev/null 2>&1
  command_status=$?
  set -e
  if [ "$command_status" -ne 0 ]; then
    printf "%s\n" "$failure_message" >&2
  fi
  return "$command_status"
}

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

profile_value() {
  local profile_path="$1"
  local key_path="$2"

  security cms -D -i "$profile_path" |
    plutil -extract "$key_path" raw -o - -
}

profile_contains_device() {
  local profile_path="$1"
  local device_count
  local index

  device_count="$(profile_value "$profile_path" ProvisionedDevices)"
  if [[ ! "$device_count" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  index=0
  while [ "$index" -lt "$device_count" ]; do
    if [ "$(profile_value "$profile_path" "ProvisionedDevices.$index")" = "$PROFILE_DEVICE_ID" ]; then
      return 0
    fi
    index=$((index + 1))
  done

  return 1
}

verify_profile() {
  local profile_path="$1"
  local expected_identifier="$2"
  local label="$3"
  local team_identifier
  local application_identifier
  local expiration_iso
  local expiration_epoch
  local minimum_expiration_epoch

  if ! team_identifier="$(profile_value "$profile_path" TeamIdentifier.0)"; then
    echo "Profilo $label non leggibile: $profile_path" >&2
    return 65
  fi
  if [ "$team_identifier" != "$DEVELOPMENT_TEAM" ]; then
    echo "Profilo $label firmato dal team $team_identifier; atteso $DEVELOPMENT_TEAM." >&2
    return 65
  fi

  if ! application_identifier="$(profile_value "$profile_path" Entitlements.application-identifier)"; then
    echo "Profilo $label senza application-identifier leggibile." >&2
    return 65
  fi
  if [ "$application_identifier" != "$expected_identifier" ]; then
    echo "Profilo $label con application-identifier $application_identifier; atteso $expected_identifier." >&2
    return 65
  fi

  if ! profile_contains_device "$profile_path"; then
    echo "Profilo $label non autorizza il device configurato." >&2
    return 65
  fi

  if ! expiration_iso="$(profile_value "$profile_path" ExpirationDate)"; then
    echo "Profilo $label senza ExpirationDate leggibile." >&2
    return 65
  fi
  if ! expiration_epoch="$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$expiration_iso" +%s 2>/dev/null)"; then
    echo "ExpirationDate non valida nel profilo $label: $expiration_iso" >&2
    return 65
  fi
  minimum_expiration_epoch=$(( $(date +%s) + MIN_PROFILE_VALIDITY_SECONDS ))
  if [ "$expiration_epoch" -lt "$minimum_expiration_epoch" ]; then
    echo "Profilo $label valido per meno di 30 giorni: rifiutata una firma temporanea." >&2
    return 65
  fi

  printf "Profilo Developer Program %s valido fino al %s.\n" "$label" "$expiration_iso"
}

verify_embedded_profiles() {
  local app_path="$1"
  local app_profile="$app_path/embedded.mobileprovision"
  local widget_profile="$app_path/PlugIns/Daily Kanji Widget.appex/embedded.mobileprovision"
  local profile_count

  profile_count="$(find "$app_path" -name embedded.mobileprovision -type f | wc -l | tr -d '[:space:]')"
  if [ "$profile_count" != "2" ] || [ ! -f "$app_profile" ] || [ ! -f "$widget_profile" ]; then
    echo "Profili embedded non validi: trovati $profile_count, attesi esattamente app e widget." >&2
    return 65
  fi

  verify_profile "$app_profile" "$APP_IDENTIFIER" "app"
  verify_profile "$widget_profile" "$WIDGET_IDENTIFIER" "widget"
}

validate_device_config_file
CONFIG_DEVICE_ID="$(config_value DEVICE_ID || true)"
DEVICE_ID="${incoming_device_id:-$CONFIG_DEVICE_ID}"
CONFIG_SYNC_ENDPOINT="$(config_value DAILY_KANJI_IOS_SYNC_ENDPOINT || true)"
CONFIG_SYNC_TOKEN="$(config_value DAILY_KANJI_IOS_SYNC_TOKEN || true)"
DAILY_KANJI_IOS_SYNC_ENDPOINT="${incoming_sync_endpoint:-$CONFIG_SYNC_ENDPOINT}"
DAILY_KANJI_IOS_SYNC_TOKEN="${incoming_sync_token:-$CONFIG_SYNC_TOKEN}"
CONFIG_MOBILE_API_ENDPOINT="$(config_value MOBILE_API_ENDPOINT || true)"
CONFIG_MOBILE_API_TOKEN="$(config_value MOBILE_API_TOKEN || true)"
MOBILE_API_ENDPOINT="${incoming_mobile_endpoint:-$CONFIG_MOBILE_API_ENDPOINT}"
MOBILE_API_TOKEN="${incoming_mobile_token:-$CONFIG_MOBILE_API_TOKEN}"
CONFIG_ENABLE_APNS="$(config_value DAILY_KANJI_ENABLE_APNS || true)"
DAILY_KANJI_ENABLE_APNS="${incoming_enable_apns:-$CONFIG_ENABLE_APNS}"

if [ -z "$DEVICE_ID" ]; then
  echo "DEVICE_ID non configurato. Impostalo in $DEVICE_CONFIG_FILE oppure nell'ambiente." >&2
  exit 2
fi
if [[ ! "$DEVICE_ID" =~ ^[[:alnum:]-]+$ ]]; then
  echo "DEVICE_ID non valido: usa soltanto lettere, numeri e trattini." >&2
  exit 2
fi

prepare_private_derived_data

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
  runtime_xcconfig="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-device.XXXXXX")"
  chmod 600 "$runtime_xcconfig"
  {
    printf "DAILY_KANJI_ENABLE_APNS = %s\n" "$DAILY_KANJI_ENABLE_APNS"
    if [ "$DAILY_KANJI_ENABLE_APNS" = "1" ]; then
      printf "DAILY_KANJI_APP_ENTITLEMENTS = DailyKanjiPush.entitlements\n"
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

for required_command in xcodebuild xcodegen xcrun security codesign plutil; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "$required_command non trovato: installazione Developer non disponibile." >&2
    exit 1
  fi
done

device_list_json="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-device-list.XXXXXX")"
chmod 600 "$device_list_json"
set +e
xcrun devicectl list devices \
  --quiet \
  --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS" \
  --json-output "$device_list_json" >/dev/null 2>&1
device_list_exit=$?
set -e
if [ "$device_list_exit" -ne 0 ]; then
  echo "Elenco CoreDevice non disponibile. Sblocca l'iPhone e riprova." >&2
  exit "$device_list_exit"
fi
if ! device_count="$(plutil -extract result.devices raw -o - "$device_list_json" 2>/dev/null)" ||
  [[ ! "$device_count" =~ ^[0-9]+$ ]]; then
  echo "Risposta CoreDevice non valida: elenco device non leggibile." >&2
  exit 65
fi

COREDEVICE_ID=""
PROFILE_DEVICE_ID=""
DEVICE_NAME=""
device_index=0
while [ "$device_index" -lt "$device_count" ]; do
  candidate_coredevice_id="$(plutil -extract "result.devices.$device_index.identifier" raw -o - "$device_list_json" 2>/dev/null || true)"
  candidate_profile_device_id="$(plutil -extract "result.devices.$device_index.hardwareProperties.udid" raw -o - "$device_list_json" 2>/dev/null || true)"
  candidate_device_name="$(plutil -extract "result.devices.$device_index.deviceProperties.name" raw -o - "$device_list_json" 2>/dev/null || true)"
  if [ "$candidate_coredevice_id" = "$DEVICE_ID" ] || [ "$candidate_profile_device_id" = "$DEVICE_ID" ]; then
    COREDEVICE_ID="$candidate_coredevice_id"
    PROFILE_DEVICE_ID="$candidate_profile_device_id"
    DEVICE_NAME="$candidate_device_name"
    break
  fi
  device_index=$((device_index + 1))
done
if [ -z "$COREDEVICE_ID" ] || [ -z "$PROFILE_DEVICE_ID" ]; then
  echo "Il device configurato e assente dalla lista CoreDevice." >&2
  exit 2
fi
if [[ ! "$COREDEVICE_ID" =~ ^[[:alnum:]-]+$ ]] || [[ ! "$PROFILE_DEVICE_ID" =~ ^[[:alnum:]-]+$ ]]; then
  echo "Risposta CoreDevice non valida: identificatori device non validi." >&2
  exit 65
fi
printf "CoreDevice configurato risolto senza esporre identificatori.\n"

device_details_json="$(mktemp "${TMPDIR:-/tmp}/daily-kanji-device-details.XXXXXX")"
chmod 600 "$device_details_json"
set +e
xcrun devicectl device info details \
  --device "$COREDEVICE_ID" \
  --quiet \
  --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS" \
  --json-output "$device_details_json" >/dev/null 2>&1
device_details_exit=$?
set -e
if [ "$device_details_exit" -ne 0 ]; then
  echo "Device configurato non raggiungibile. Sblocca l'iPhone e usa la stessa Wi-Fi del Mac." >&2
  exit "$device_details_exit"
fi
details_coredevice_id="$(plutil -extract result.identifier raw -o - "$device_details_json" 2>/dev/null || true)"
details_profile_device_id="$(plutil -extract result.hardwareProperties.udid raw -o - "$device_details_json" 2>/dev/null || true)"
details_device_name="$(plutil -extract result.deviceProperties.name raw -o - "$device_details_json" 2>/dev/null || true)"
if [ "$details_coredevice_id" != "$COREDEVICE_ID" ] || [ "$details_profile_device_id" != "$PROFILE_DEVICE_ID" ]; then
  echo "Risposta CoreDevice incoerente per il device selezionato." >&2
  exit 65
fi
if [ -n "$details_device_name" ]; then
  DEVICE_NAME="$details_device_name"
fi
tunnel_state="$(plutil -extract result.connectionProperties.tunnelState raw -o - "$device_details_json" 2>/dev/null || printf sconosciuto)"
printf "Tunnel CoreDevice: %s\n" "$tunnel_state"

run_private_device_command \
  "Developer Disk Image non disponibile. Sblocca l'iPhone e usa la stessa Wi-Fi del Mac." \
  xcrun devicectl device info ddiServices \
  --device "$COREDEVICE_ID" \
  --quiet \
  --auto-mount-ddis \
  --timeout "$DDI_MOUNT_TIMEOUT_SECONDS"
printf "Developer Disk Image pronta.\n"

if [ -n "${DAILY_KANJI_IOS_SYNC_ENDPOINT:-}" ]; then
  printf "Daily Kanji dataset sync: configurato\n"
else
  printf "Daily Kanji dataset sync: non configurato\n"
fi
if [ -n "${MOBILE_API_ENDPOINT:-}" ]; then
  printf "Daily Kanji live review API: configurata\n"
else
  printf "Daily Kanji live review API: non configurata\n"
fi
printf "Daily Kanji APNs entitlement: %s\n" "$([ "$DAILY_KANJI_ENABLE_APNS" = "1" ] && printf abilitato || printf disabilitato)"

cd "$ROOT"
"$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:verify-resources -- --ios-root "$ROOT"
xcodegen generate

xcodebuild_args=(
  -quiet
  -project "$PROJECT"
  -scheme "$SCHEME"
  -configuration "$CONFIGURATION"
  -destination "id=$PROFILE_DEVICE_ID"
  -derivedDataPath "$DERIVED_DATA"
  -allowProvisioningUpdates
  -allowProvisioningDeviceRegistration
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
  redact_private_values "$xcodebuild_output" >&2
  cat >&2 <<'HINT'
Firma Apple Developer Program non pronta. Apri Xcode > Settings > Accounts,
verifica il team e aggiorna i profili automatici per app e widget, poi riprova.
HINT
  exit "$xcodebuild_status"
fi

APP_PATH="$DERIVED_DATA/Build/Products/$CONFIGURATION-iphoneos/Daily Kanji.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Build completata ma app non trovata: $APP_PATH" >&2
  exit 1
fi

verify_embedded_profiles "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"
run_private_device_command \
  "Installazione sul device non riuscita." \
  xcrun devicectl device install app --device "$COREDEVICE_ID" --quiet "$APP_PATH"
printf "App installata sul device configurato.\n"
run_private_device_command \
  "Avvio di Daily Kanji sul device non riuscito." \
  xcrun devicectl device process launch --device "$COREDEVICE_ID" --quiet dev.local.daily-kanji
printf "Daily Kanji avviata sul device configurato.\n"

printf "Installazione Developer Program completata: %s\n" "$APP_PATH"
