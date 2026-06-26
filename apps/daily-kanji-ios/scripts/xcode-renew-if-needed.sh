#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
RENEW_MIN_AGE_SECONDS="${RENEW_MIN_AGE_SECONDS:-432000}"
LOCK_MAX_AGE_SECONDS="${LOCK_MAX_AGE_SECONDS:-21600}"
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"
LOCK_DIR="$STATE_DIR/renew.lock"
LAST_SUCCESS_FILE="$STATE_DIR/last-renew-success.epoch"
FORCE=0

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

usage() {
  cat <<'USAGE'
Usage: xcode-renew-if-needed.sh [--force] [--status] [--mark-success-now]

Runs the expensive Xcode renew/install only when all conditions are true:
  - the last successful renew is older than RENEW_MIN_AGE_SECONDS
  - the configured iPhone is reachable through CoreDevice
  - no other renew job is currently running

Environment:
  DEVICE_ID                 CoreDevice identifier of the target iPhone.
  CONFIG_FILE               Default: ~/Library/Application Support/DailyKanji/renew.env.
  RENEW_MIN_AGE_SECONDS     Default: 432000 (5 days).
  LOCK_MAX_AGE_SECONDS      Default: 21600 (6 hours).
  COREDEVICE_INFO_TIMEOUT_SECONDS Default: 60.
  DDI_MOUNT_TIMEOUT_SECONDS       Default: 120.
  STATE_DIR                 Default: ~/Library/Application Support/DailyKanji.
  LOG_DIR                   Default: ~/Library/Logs/DailyKanji.
USAGE
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

mark_success_now() {
  ensure_directories
  now_epoch > "$LAST_SUCCESS_FILE"
  printf "Marked Daily Kanji renew success at epoch %s\n" "$(cat "$LAST_SUCCESS_FILE")"
}

last_success_epoch() {
  if [ ! -f "$LAST_SUCCESS_FILE" ]; then
    return 1
  fi

  local value
  value="$(cat "$LAST_SUCCESS_FILE")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  printf "%s\n" "$value"
}

should_renew() {
  if [ "$FORCE" -eq 1 ]; then
    return 0
  fi

  local last_success
  if ! last_success="$(last_success_epoch)"; then
    return 0
  fi

  local age_seconds
  age_seconds=$(( $(now_epoch) - last_success ))

  [ "$age_seconds" -ge "$RENEW_MIN_AGE_SECONDS" ]
}

device_reachable() {
  if [ -z "${DEVICE_ID:-}" ]; then
    return 1
  fi

  xcrun devicectl device info details \
    --device "$DEVICE_ID" \
    --timeout "$COREDEVICE_INFO_TIMEOUT_SECONDS" >/dev/null 2>&1
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
    printf "Daily Kanji iPhone bloccato: sblocca l'iPhone e lascialo acceso, poi il rinnovo riprovera' al prossimo giro.\n"
    printf "%s\n" "$output"
    return 1
  fi

  printf "Daily Kanji developer disk image non pronta; il rinnovo riprovera' al prossimo giro.\n"
  printf "%s\n" "$output"
  return 1
}

print_status() {
  ensure_directories
  if [ -n "${DEVICE_ID:-}" ]; then
    printf "Device ID: %s\n" "$DEVICE_ID"
  else
    printf "Device ID: not configured\n"
  fi
  printf "Config file: %s\n" "$CONFIG_FILE"
  printf "State file: %s\n" "$LAST_SUCCESS_FILE"
  printf "Renew min age: %ss\n" "$RENEW_MIN_AGE_SECONDS"
  printf "Lock max age: %ss\n" "$LOCK_MAX_AGE_SECONDS"
  printf "CoreDevice info timeout: %ss\n" "$COREDEVICE_INFO_TIMEOUT_SECONDS"
  printf "DDI mount timeout: %ss\n" "$DDI_MOUNT_TIMEOUT_SECONDS"

  local last_success
  if last_success="$(last_success_epoch)"; then
    local age_seconds
    age_seconds=$(( $(now_epoch) - last_success ))
    printf "Last success epoch: %s\n" "$last_success"
    printf "Last success age: %ss\n" "$age_seconds"
  else
    printf "Last success epoch: none\n"
  fi

  if should_renew; then
    printf "Renew due: yes\n"
  else
    printf "Renew due: no\n"
  fi

  if device_reachable; then
    printf "Device reachable: yes\n"
  else
    printf "Device reachable: no\n"
  fi
}

lock_epoch() {
  local value

  if [ ! -f "$LOCK_DIR/epoch" ]; then
    return 1
  fi

  value="$(cat "$LOCK_DIR/epoch")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  printf "%s\n" "$value"
}

lock_pid() {
  local value

  if [ ! -f "$LOCK_DIR/pid" ]; then
    return 1
  fi

  value="$(cat "$LOCK_DIR/pid")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  printf "%s\n" "$value"
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
  rm -f "$LOCK_DIR/pid" "$LOCK_DIR/epoch"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

recover_stale_lock_if_needed() {
  local epoch
  local age_seconds

  if ! epoch="$(lock_epoch)"; then
    remove_lock_dir
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
    printf "%s\n" "$$" > "$LOCK_DIR/pid"
    now_epoch > "$LOCK_DIR/epoch"
    return 0
  fi

  recover_stale_lock_if_needed

  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf "%s\n" "$$" > "$LOCK_DIR/pid"
    now_epoch > "$LOCK_DIR/epoch"
    return 0
  fi

  return 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      ;;
    --status)
      print_status
      exit 0
      ;;
    --mark-success-now)
      mark_success_now
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

ensure_directories

if ! acquire_lock; then
  printf "Daily Kanji renew already running; skipping.\n"
  exit 0
fi
trap 'remove_lock_dir' EXIT

if ! should_renew; then
  printf "Daily Kanji renew not due; skipping.\n"
  exit 0
fi

if [ -z "${DEVICE_ID:-}" ]; then
  printf "Daily Kanji DEVICE_ID not configured; skipping.\n"
  exit 0
fi

if ! device_reachable; then
  printf "Daily Kanji device %s not reachable; skipping.\n" "$DEVICE_ID"
  exit 0
fi

if ! developer_disk_image_ready; then
  exit 0
fi

cd "$REPO_ROOT"
"$REPO_ROOT/scripts/with-node.sh" pnpm daily-kanji:package
DEVICE_ID="$DEVICE_ID" "$ROOT/scripts/xcode-renew.sh"
mark_success_now
