#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
RENEW_BEFORE_EXPIRY_SECONDS="${RENEW_BEFORE_EXPIRY_SECONDS:-172800}"
RENEW_CHECK_INTERVAL_SECONDS="${RENEW_CHECK_INTERVAL_SECONDS:-14400}"
LOCK_MAX_AGE_SECONDS="${LOCK_MAX_AGE_SECONDS:-21600}"
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"
LOCK_DIR="$STATE_DIR/renew.lock"
LAST_SUCCESS_FILE="$STATE_DIR/last-renew-success.epoch"
PROFILE_EXPIRY_FILE="${PROFILE_EXPIRY_FILE:-$STATE_DIR/profile-expiry.epoch}"
FORCE=0

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

usage() {
  cat <<'USAGE'
Usage: xcode-renew-if-needed.sh [--force] [--status]

Checks the recorded embedded provisioning profile expiry. The normal launchd
run exits before CoreDevice, packaging, or Xcode work until the preventive
renewal window opens. Inside the window it attempts a complete Release build
and install; failures are non-zero and launchd retries at its next interval.

Environment:
  DEVICE_ID                         CoreDevice identifier of the target iPhone.
  CONFIG_FILE                       Default: ~/Library/Application Support/DailyKanji/renew.env.
  RENEW_BEFORE_EXPIRY_SECONDS       Default: 172800 (48 hours).
  RENEW_CHECK_INTERVAL_SECONDS      Default: 14400 (4 hours; status only here).
  LOCK_MAX_AGE_SECONDS              Default: 21600 (6 hours).
  COREDEVICE_INFO_TIMEOUT_SECONDS   Default: 60.
  DDI_MOUNT_TIMEOUT_SECONDS         Default: 120.
  STATE_DIR                         Default: ~/Library/Application Support/DailyKanji.
  LOG_DIR                           Default: ~/Library/Logs/DailyKanji.
USAGE
}

is_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

validate_settings() {
  local name
  local value

  for name in \
    RENEW_BEFORE_EXPIRY_SECONDS \
    RENEW_CHECK_INTERVAL_SECONDS \
    LOCK_MAX_AGE_SECONDS \
    COREDEVICE_INFO_TIMEOUT_SECONDS \
    DDI_MOUNT_TIMEOUT_SECONDS; do
    value="${!name}"
    if ! is_positive_integer "$value"; then
      printf "Daily Kanji invalid %s=%s; expected a positive integer.\n" "$name" "$value" >&2
      exit 78
    fi
  done
}

now_epoch() {
  date +%s
}

ensure_directories() {
  mkdir -p "$STATE_DIR" "$LOG_DIR"
}

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

file_epoch() {
  local file_path="$1"
  local value

  if [ ! -f "$file_path" ]; then
    return 1
  fi

  value="$(cat "$file_path")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  printf "%s\n" "$value"
}

profile_expiry_epoch() {
  file_epoch "$PROFILE_EXPIRY_FILE"
}

last_success_epoch() {
  file_epoch "$LAST_SUCCESS_FILE"
}

renew_window_epoch() {
  local profile_expiry="$1"
  local window_epoch

  window_epoch=$(( profile_expiry - RENEW_BEFORE_EXPIRY_SECONDS ))
  if [ "$window_epoch" -lt 0 ]; then
    window_epoch=0
  fi
  printf "%s\n" "$window_epoch"
}

should_renew() {
  if [ "$FORCE" -eq 1 ]; then
    return 0
  fi

  local profile_expiry
  if ! profile_expiry="$(profile_expiry_epoch)"; then
    return 0
  fi

  [ "$(now_epoch)" -ge "$(renew_window_epoch "$profile_expiry")" ]
}

format_epoch() {
  local epoch="$1"
  date -r "$epoch" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null || printf "%s" "$epoch"
}

print_status() {
  local current_epoch
  local last_success
  local profile_expiry
  local window_epoch

  current_epoch="$(now_epoch)"
  printf "Daily Kanji automatic renew status\n"
  printf "Device ID: %s\n" "${DEVICE_ID:-not configured}"
  printf "Config file: %s\n" "$CONFIG_FILE"
  printf "Profile expiry file: %s\n" "$PROFILE_EXPIRY_FILE"
  printf "Last success file: %s\n" "$LAST_SUCCESS_FILE"
  printf "Preventive window: %ss before expiry\n" "$RENEW_BEFORE_EXPIRY_SECONDS"
  printf "LaunchAgent check interval: %ss\n" "$RENEW_CHECK_INTERVAL_SECONDS"

  if last_success="$(last_success_epoch)"; then
    printf "Last verified success: %s (%s; %ss ago)\n" \
      "$last_success" "$(format_epoch "$last_success")" "$(( current_epoch - last_success ))"
  else
    printf "Last verified success: none\n"
  fi

  if profile_expiry="$(profile_expiry_epoch)"; then
    window_epoch="$(renew_window_epoch "$profile_expiry")"
    printf "Profile expiry: %s (%s)\n" "$profile_expiry" "$(format_epoch "$profile_expiry")"
    printf "Renewal window opens: %s (%s)\n" "$window_epoch" "$(format_epoch "$window_epoch")"
    if [ "$current_epoch" -lt "$window_epoch" ]; then
      printf "Time until renewal window: %ss\n" "$(( window_epoch - current_epoch ))"
    elif [ "$current_epoch" -lt "$profile_expiry" ]; then
      printf "Time until profile expiry: %ss\n" "$(( profile_expiry - current_epoch ))"
    else
      printf "Profile expired: %ss ago\n" "$(( current_epoch - profile_expiry ))"
    fi
  else
    printf "Profile expiry: missing or invalid (renewal required)\n"
  fi

  if should_renew; then
    printf "Renew due: yes\n"
  else
    printf "Renew due: no\n"
  fi
  printf "Device reachability: checked only during a due/forced attempt\n"
}

device_reachable() {
  local output
  local status

  set +e
  output="$(xcrun devicectl device info details \
    --device "$DEVICE_ID" \
    --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS" 2>&1)"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    return 0
  fi

  printf "Daily Kanji device %s not reachable; CoreDevice exited %s. launchd will retry at the next interval.\n" \
    "$DEVICE_ID" "$status" >&2
  if [ -n "$output" ]; then
    printf "%s\n" "$output" >&2
  fi
  return "$status"
}

developer_disk_image_ready() {
  local output
  local status

  set +e
  output="$(xcrun devicectl device info ddiServices \
    --device "$DEVICE_ID" \
    --auto-mount-ddis \
    --timeout "$DDI_MOUNT_TIMEOUT_SECONDS" 2>&1)"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    printf "Daily Kanji developer disk image services ready.\n"
    return 0
  fi

  if [[ "$output" == *"kAMDMobileImageMounterDeviceLocked"* ]] ||
    [[ "$output" == *"device is locked"* ]] ||
    [[ "$output" == *"The device is locked"* ]]; then
    printf "Daily Kanji iPhone bloccato: sblocca l'iPhone; DDI exited %s and launchd will retry at the next interval.\n" \
      "$status" >&2
  else
    printf "Daily Kanji developer disk image non pronta; DDI exited %s and launchd will retry at the next interval.\n" \
      "$status" >&2
  fi
  if [ -n "$output" ]; then
    printf "%s\n" "$output" >&2
  fi
  return "$status"
}

lock_epoch() {
  local value

  if value="$(file_epoch "$LOCK_DIR/epoch")"; then
    printf "%s\n" "$value"
    return 0
  fi

  stat -f %m "$LOCK_DIR" 2>/dev/null
}

lock_pid() {
  file_epoch "$LOCK_DIR/pid"
}

lock_owner_active() {
  local pid
  local command

  if ! pid="$(lock_pid)"; then
    return 1
  fi

  if ! command="$(ps -p "$pid" -o command= 2>/dev/null)"; then
    return 1
  fi

  [[ "$command" == *"xcode-renew-if-needed.sh"* ]]
}

remove_lock_dir() {
  rm -f "$LOCK_DIR/pid" "$LOCK_DIR/epoch" 2>/dev/null || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

cleanup_after_renew() {
  local exit_code="$?"
  trap - EXIT
  set +e
  remove_lock_dir
  exit "$exit_code"
}

recover_stale_lock_if_needed() {
  local epoch
  local age_seconds

  if ! epoch="$(lock_epoch)"; then
    return
  fi

  age_seconds=$(( $(now_epoch) - epoch ))
  if [ "$age_seconds" -lt "$LOCK_MAX_AGE_SECONDS" ]; then
    return
  fi

  if lock_owner_active; then
    return
  fi

  printf "Removing stale Daily Kanji renew lock aged %ss.\n" "$age_seconds"
  remove_lock_dir
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    initialize_lock_metadata
    return "$?"
  fi

  recover_stale_lock_if_needed

  if mkdir "$LOCK_DIR" 2>/dev/null; then
    initialize_lock_metadata
    return "$?"
  fi

  return 1
}

initialize_lock_metadata() {
  local lock_time
  local status

  if printf "%s\n" "$$" > "$LOCK_DIR/pid"; then
    :
  else
    status="$?"
    remove_lock_dir
    printf "Daily Kanji could not write renew lock pid (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if lock_time="$(now_epoch)"; then
    :
  else
    status="$?"
    remove_lock_dir
    printf "Daily Kanji could not read time for renew lock (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if printf "%s\n" "$lock_time" > "$LOCK_DIR/epoch"; then
    return 0
  else
    status="$?"
    remove_lock_dir
    printf "Daily Kanji could not write renew lock epoch (exit %s).\n" "$status" >&2
    return "$status"
  fi
}

mark_verified_success() {
  local temp
  local success_epoch
  local status

  if temp="$(mktemp "$LAST_SUCCESS_FILE.XXXXXX")"; then
    :
  else
    status="$?"
    printf "Daily Kanji could not create success marker temp file (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if success_epoch="$(now_epoch)"; then
    :
  else
    status="$?"
    rm -f "$temp"
    printf "Daily Kanji could not read time for success marker (exit %s).\n" "$status" >&2
    return "$status"
  fi

  if printf "%s\n" "$success_epoch" > "$temp" &&
    chmod 600 "$temp" &&
    mv "$temp" "$LAST_SUCCESS_FILE"; then
    return 0
  else
    status="$?"
    rm -f "$temp"
    printf "Daily Kanji could not atomically record verified success (exit %s).\n" "$status" >&2
    return "$status"
  fi
}

validate_refreshed_expiry() {
  local previous_expiry="$1"
  local renewed_expiry
  local minimum_acceptable_expiry

  if ! renewed_expiry="$(profile_expiry_epoch)"; then
    printf "Daily Kanji renew/install exited 0 but did not record a valid profile expiry; refusing false success.\n" >&2
    return 70
  fi

  minimum_acceptable_expiry=$(( $(now_epoch) + RENEW_BEFORE_EXPIRY_SECONDS ))
  if [ "$renewed_expiry" -le "$minimum_acceptable_expiry" ]; then
    printf "Daily Kanji renewed profile expiry %s does not clear the %ss window (must be after %s); refusing false success.\n" \
      "$renewed_expiry" "$RENEW_BEFORE_EXPIRY_SECONDS" "$minimum_acceptable_expiry" >&2
    return 70
  fi

  if [ -n "$previous_expiry" ] && [ "$renewed_expiry" -le "$previous_expiry" ]; then
    printf "Daily Kanji profile expiry did not advance (%s -> %s); refusing false success.\n" \
      "$previous_expiry" "$renewed_expiry" >&2
    return 70
  fi

  printf "Daily Kanji profile expiry refreshed: %s (%s).\n" \
    "$renewed_expiry" "$(format_epoch "$renewed_expiry")"
}

run_and_report() {
  local label="$1"
  shift
  local status

  set +e
  "$@"
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    printf "Daily Kanji %s failed with exit %s; launchd will retry at the next interval.\n" \
      "$label" "$status" >&2
  fi
  return "$status"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      ;;
    --status)
      validate_settings
      print_status
      exit 0
      ;;
    --mark-success-now)
      printf "Daily Kanji --mark-success-now is deprecated and ignored; success is recorded only after a verified install.\n" >&2
      exit 0
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf "Unknown argument: %s\n\n" "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

validate_settings

# RunAtLoad and every periodic check take this cheap path until the preventive
# window opens. In particular, no lock, CoreDevice, packaging, or Xcode work is
# performed here.
if ! should_renew; then
  printf "Daily Kanji renew not due; outside the %ss preventive window.\n" \
    "$RENEW_BEFORE_EXPIRY_SECONDS"
  exit 0
fi

ensure_directories

if ! acquire_lock; then
  printf "Daily Kanji renew already running; launchd will retry at the next interval.\n" >&2
  exit 75
fi
trap cleanup_after_renew EXIT

# The expiry may have been refreshed while this process waited for the lock.
if ! should_renew; then
  printf "Daily Kanji renew no longer due after acquiring the lock; skipping.\n"
  exit 0
fi

previous_expiry="$(profile_expiry_epoch || true)"

if [ -z "${DEVICE_ID:-}" ]; then
  printf "Daily Kanji DEVICE_ID not configured; launchd cannot renew (exit 78).\n" >&2
  exit 78
fi

if device_reachable; then
  :
else
  exit "$?"
fi

if developer_disk_image_ready; then
  :
else
  exit "$?"
fi

cd "$REPO_ROOT"
if run_and_report "resource package" \
  "$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:package; then
  :
else
  exit "$?"
fi

if DEVICE_ID="$DEVICE_ID" run_and_report "Release build/install" \
  "$ROOT/scripts/xcode-renew.sh"; then
  :
else
  exit "$?"
fi

if validate_refreshed_expiry "$previous_expiry"; then
  :
else
  exit "$?"
fi

if mark_verified_success; then
  :
else
  exit "$?"
fi
printf "Daily Kanji automatic renew completed and verified.\n"
