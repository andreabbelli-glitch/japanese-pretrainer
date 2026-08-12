#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${LABEL:-dev.local.daily-kanji.renew}"
PLIST="${PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
DEVICE_ID="${DEVICE_ID:-}"
PROFILE_EXPIRY_FILE="${PROFILE_EXPIRY_FILE:-$STATE_DIR/profile-expiry.epoch}"
RENEW_BEFORE_EXPIRY_SECONDS="${RENEW_BEFORE_EXPIRY_SECONDS:-172800}"
RENEW_CHECK_INTERVAL_SECONDS="${RENEW_CHECK_INTERVAL_SECONDS:-${START_INTERVAL_SECONDS:-14400}}"
LOCK_MAX_AGE_SECONDS="${LOCK_MAX_AGE_SECONDS:-21600}"
COREDEVICE_INFO_TIMEOUT_SECONDS="${COREDEVICE_INFO_TIMEOUT_SECONDS:-60}"
DDI_MOUNT_TIMEOUT_SECONDS="${DDI_MOUNT_TIMEOUT_SECONDS:-120}"
UNINSTALL=0
LEGACY_MARK_SUCCESS_NOW=0
LEGACY_RESCHEDULE_ONLY=0
PLIST_TEMP=""
PLIST_BACKUP=""
PRESERVE_PLIST_BACKUP=0

usage() {
  cat <<'USAGE'
Usage: install-renew-launchd.sh [--device-id <id>] [--uninstall]

Installs a persistent user LaunchAgent. It runs a cheap check at login/load and
every four hours by default. The expensive CoreDevice/package/Release build and
install path starts only during the last 48 hours of the recorded profile.
Failed due attempts exit non-zero and are retried at the next fixed interval.

The device id is stored in a local, untracked config file. Reinstalling updates
only DEVICE_ID and preserves sync/API settings already present there.

Environment:
  DEVICE_ID                         CoreDevice identifier of the target iPhone.
  CONFIG_FILE                       Default: ~/Library/Application Support/DailyKanji/renew.env.
  PROFILE_EXPIRY_FILE               Default: ~/Library/Application Support/DailyKanji/profile-expiry.epoch.
  RENEW_BEFORE_EXPIRY_SECONDS       Default: 172800 (48 hours).
  RENEW_CHECK_INTERVAL_SECONDS      Default: 14400 (4 hours).
  START_INTERVAL_SECONDS            Legacy fallback for the check interval.
  LOCK_MAX_AGE_SECONDS              Default: 21600 (6 hours).
  COREDEVICE_INFO_TIMEOUT_SECONDS   Default: 60.
  DDI_MOUNT_TIMEOUT_SECONDS         Default: 120.

Deprecated compatibility options:
  --mark-success-now   Accepted but never creates a success marker.
  --reschedule-only    Reinstalls the same persistent LaunchAgent.
USAGE
}

cleanup_temp() {
  if [ -n "$PLIST_TEMP" ] && [ -f "$PLIST_TEMP" ]; then
    rm -f "$PLIST_TEMP" 2>/dev/null || true
  fi
  if [ "$PRESERVE_PLIST_BACKUP" -eq 0 ] &&
    [ -n "$PLIST_BACKUP" ] &&
    [ -f "$PLIST_BACKUP" ]; then
    rm -f "$PLIST_BACKUP" 2>/dev/null || true
  fi
}

trap cleanup_temp EXIT

xml_escape() {
  sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

escaped() {
  printf "%s" "$1" | xml_escape
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

write_config_value() {
  local key="$1"
  local value="$2"
  local temp

  temp="$(mktemp "$CONFIG_FILE.XXXXXX")"
  chmod 600 "$temp"

  if [ -f "$CONFIG_FILE" ]; then
    if ! awk -F= -v key="$key" -v value="$value" '
      BEGIN { written = 0 }
      $1 == key {
        if (!written) {
          print key "=" value
          written = 1
        }
        next
      }
      { print }
      END {
        if (!written) {
          print key "=" value
        }
      }
    ' "$CONFIG_FILE" > "$temp"; then
      rm -f "$temp"
      return 1
    fi
  elif ! printf "%s=%s\n" "$key" "$value" > "$temp"; then
    rm -f "$temp"
    return 1
  fi

  mv "$temp" "$CONFIG_FILE"
}

validate_device_id() {
  if [[ ! "$DEVICE_ID" =~ ^[A-Za-z0-9._:-]+$ ]]; then
    printf "Invalid DEVICE_ID. Use a CoreDevice id or UDID with letters, digits, dot, colon, underscore, or dash.\n" >&2
    exit 2
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --device-id)
      if [ -z "${2:-}" ]; then
        printf "Missing value for --device-id.\n\n" >&2
        usage >&2
        exit 2
      fi
      DEVICE_ID="$2"
      shift
      ;;
    --mark-success-now)
      LEGACY_MARK_SUCCESS_NOW=1
      ;;
    --reschedule-only)
      LEGACY_RESCHEDULE_ONLY=1
      ;;
    --uninstall)
      UNINSTALL=1
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

if [ "$UNINSTALL" -eq 1 ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  printf "Removed Daily Kanji LaunchAgent: %s\n" "$PLIST"
  exit 0
fi

validate_settings

CONFIG_DEVICE_ID="$(config_value DEVICE_ID || true)"
DEVICE_ID="${DEVICE_ID:-$CONFIG_DEVICE_ID}"
if [ -z "$DEVICE_ID" ]; then
  printf "DEVICE_ID is required for install.\n" >&2
  printf "Run: DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh\n" >&2
  exit 2
fi
validate_device_id

if [ "$LEGACY_MARK_SUCCESS_NOW" -eq 1 ]; then
  printf "Daily Kanji --mark-success-now is deprecated and ignored; only a verified install records success.\n" >&2
fi
if [ "$LEGACY_RESCHEDULE_ONLY" -eq 1 ]; then
  printf "Daily Kanji --reschedule-only is deprecated; reinstalling the persistent interval job.\n" >&2
fi

mkdir -p "$(dirname "$PLIST")" "$STATE_DIR" "$LOG_DIR" "$(dirname "$CONFIG_FILE")"
umask 077
write_config_value DEVICE_ID "$DEVICE_ID"

PROGRAM="$(escaped "$ROOT/scripts/xcode-renew-if-needed.sh")"
STDOUT_LOG="$(escaped "$LOG_DIR/xcode-renew.out.log")"
STDERR_LOG="$(escaped "$LOG_DIR/xcode-renew.err.log")"
CONFIG_FILE_XML="$(escaped "$CONFIG_FILE")"
DEVELOPER_DIR_XML="$(escaped "${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}")"
PROFILE_EXPIRY_FILE_XML="$(escaped "$PROFILE_EXPIRY_FILE")"
STATE_DIR_XML="$(escaped "$STATE_DIR")"
LOG_DIR_XML="$(escaped "$LOG_DIR")"

PLIST_TEMP="$(mktemp "$PLIST.XXXXXX")"
cat > "$PLIST_TEMP" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PROGRAM</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CONFIG_FILE</key>
    <string>$CONFIG_FILE_XML</string>
    <key>CONFIGURATION</key>
    <string>Release</string>
    <key>DEVELOPER_DIR</key>
    <string>$DEVELOPER_DIR_XML</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PROFILE_EXPIRY_FILE</key>
    <string>$PROFILE_EXPIRY_FILE_XML</string>
    <key>RENEW_BEFORE_EXPIRY_SECONDS</key>
    <string>$RENEW_BEFORE_EXPIRY_SECONDS</string>
    <key>RENEW_CHECK_INTERVAL_SECONDS</key>
    <string>$RENEW_CHECK_INTERVAL_SECONDS</string>
    <key>LOCK_MAX_AGE_SECONDS</key>
    <string>$LOCK_MAX_AGE_SECONDS</string>
    <key>COREDEVICE_INFO_TIMEOUT_SECONDS</key>
    <string>$COREDEVICE_INFO_TIMEOUT_SECONDS</string>
    <key>DDI_MOUNT_TIMEOUT_SECONDS</key>
    <string>$DDI_MOUNT_TIMEOUT_SECONDS</string>
    <key>STATE_DIR</key>
    <string>$STATE_DIR_XML</string>
    <key>LOG_DIR</key>
    <string>$LOG_DIR_XML</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>$RENEW_CHECK_INTERVAL_SECONDS</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>LowPriorityIO</key>
  <true/>
  <key>Nice</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$STDOUT_LOG</string>
  <key>StandardErrorPath</key>
  <string>$STDERR_LOG</string>
</dict>
</plist>
PLIST

if plutil -lint "$PLIST_TEMP" >/dev/null; then
  :
else
  status="$?"
  printf "Daily Kanji LaunchAgent plist validation failed with exit %s; existing job was left untouched.\n" \
    "$status" >&2
  exit "$status"
fi

domain="gui/$(id -u)"
service_target="$domain/$LABEL"

if launchctl enable "$service_target"; then
  :
else
  status="$?"
  printf "Daily Kanji LaunchAgent enable failed with exit %s for %s\n" \
    "$status" "$LABEL" >&2
  exit "$status"
fi

had_previous_plist=0
if [ -f "$PLIST" ]; then
  PLIST_BACKUP="$(mktemp "$PLIST.rollback.XXXXXX")"
  if cp -p "$PLIST" "$PLIST_BACKUP"; then
    had_previous_plist=1
  else
    status="$?"
    printf "Daily Kanji could not back up the existing LaunchAgent plist (exit %s); existing job was left untouched.\n" \
      "$status" >&2
    exit "$status"
  fi
fi

if mv "$PLIST_TEMP" "$PLIST"; then
  PLIST_TEMP=""
else
  status="$?"
  printf "Daily Kanji could not install the new LaunchAgent plist (exit %s); existing job was left untouched.\n" \
    "$status" >&2
  exit "$status"
fi

launchctl bootout "$domain" "$PLIST" >/dev/null 2>&1 || true
if launchctl bootstrap "$domain" "$PLIST"; then
  if [ "$had_previous_plist" -eq 1 ]; then
    if rm -f "$PLIST_BACKUP"; then
      PLIST_BACKUP=""
    else
      PRESERVE_PLIST_BACKUP=1
      printf "Daily Kanji installed the new LaunchAgent, but could not remove rollback backup: %s\n" \
        "$PLIST_BACKUP" >&2
    fi
  fi
else
  bootstrap_status="$?"
  printf "Daily Kanji new LaunchAgent bootstrap failed with exit %s for %s; rolling back.\n" \
    "$bootstrap_status" "$PLIST" >&2

  # A failed bootstrap can still leave a partially registered service. Clear it
  # before restoring/reloading the previous plist or removing the failed new one.
  launchctl bootout "$service_target" >/dev/null 2>&1 || true

  if [ "$had_previous_plist" -eq 1 ]; then
    if mv "$PLIST_BACKUP" "$PLIST"; then
      PLIST_BACKUP=""
      if launchctl bootstrap "$domain" "$PLIST"; then
        printf "Daily Kanji previous LaunchAgent plist restored and re-bootstrap succeeded.\n" >&2
      else
        rollback_bootstrap_status="$?"
        printf "Daily Kanji previous LaunchAgent plist was restored, but re-bootstrap failed with exit %s; manual launchctl recovery is required.\n" \
          "$rollback_bootstrap_status" >&2
      fi
    else
      rollback_restore_status="$?"
      PRESERVE_PLIST_BACKUP=1
      printf "Daily Kanji could not restore the previous LaunchAgent plist (exit %s); backup preserved at %s for manual recovery.\n" \
        "$rollback_restore_status" "$PLIST_BACKUP" >&2
    fi
  else
    if rm -f "$PLIST"; then
      printf "Daily Kanji removed the failed new LaunchAgent plist; no previous plist existed.\n" >&2
    else
      rollback_remove_status="$?"
      printf "Daily Kanji could not remove the failed new LaunchAgent plist (exit %s): %s\n" \
        "$rollback_remove_status" "$PLIST" >&2
    fi
  fi

  exit "$bootstrap_status"
fi

printf "Installed Daily Kanji persistent LaunchAgent: %s\n" "$PLIST"
printf "Label: %s\n" "$LABEL"
printf "Run at load: yes\n"
printf "Check/retry interval: %ss\n" "$RENEW_CHECK_INTERVAL_SECONDS"
printf "Preventive renewal window: %ss before profile expiry\n" "$RENEW_BEFORE_EXPIRY_SECONDS"
printf "Physical-device build configuration: Release\n"
printf "Config: %s\n" "$CONFIG_FILE"
printf "Logs:\n  %s\n  %s\n" "$LOG_DIR/xcode-renew.out.log" "$LOG_DIR/xcode-renew.err.log"
