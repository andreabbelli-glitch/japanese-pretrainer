#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${LABEL:-dev.local.daily-kanji.renew}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
DEVICE_ID="${DEVICE_ID:-}"
PROFILE_EXPIRY_FILE="${PROFILE_EXPIRY_FILE:-$STATE_DIR/profile-expiry.epoch}"
RENEW_MIN_AGE_SECONDS="${RENEW_MIN_AGE_SECONDS:-432000}"
RENEW_AFTER_EXPIRY_GRACE_SECONDS="${RENEW_AFTER_EXPIRY_GRACE_SECONDS:-120}"
RENEW_RETRY_DELAY_SECONDS="${RENEW_RETRY_DELAY_SECONDS:-1800}"
MARK_SUCCESS_NOW=0
RESCHEDULE_ONLY=0
UNINSTALL=0

usage() {
  cat <<'USAGE'
Usage: install-renew-launchd.sh [--device-id <id>] [--mark-success-now] [--reschedule-only] [--uninstall]

Installs a user LaunchAgent that runs xcode-renew-if-needed.sh after the
recorded embedded provisioning profile expiry has passed.
After each automatic attempt, the wrapper asks this script to reschedule launchd
from the latest recorded profile expiry.
The device id is stored in a local, untracked config file.

Environment:
  DEVICE_ID                  CoreDevice identifier of the target iPhone.
  CONFIG_FILE                Default: ~/Library/Application Support/DailyKanji/renew.env.
  PROFILE_EXPIRY_FILE        Default: ~/Library/Application Support/DailyKanji/profile-expiry.epoch.
  RENEW_MIN_AGE_SECONDS       Default: 432000 (5 days).
  RENEW_AFTER_EXPIRY_GRACE_SECONDS Default: 120.
  RENEW_RETRY_DELAY_SECONDS   Default: 1800 (30 minutes).
USAGE
}

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

now_epoch() {
  date +%s
}

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

ceil_to_next_minute() {
  local epoch="$1"
  local remainder

  remainder=$(( epoch % 60 ))
  if [ "$remainder" -eq 0 ]; then
    printf "%s\n" "$epoch"
    return
  fi

  printf "%s\n" "$(( epoch + 60 - remainder ))"
}

date_component() {
  local epoch="$1"
  local format="$2"
  local value

  value="$(date -r "$epoch" "$format")"
  printf "%d\n" "$((10#$value))"
}

schedule_run_at_load_value() {
  if [ "$RESCHEDULE_ONLY" -eq 1 ]; then
    printf "0\n"
  else
    printf "1\n"
  fi
}

compute_schedule() {
  local now
  local profile_expiry
  local renew_epoch

  now="$(now_epoch)"
  if profile_expiry="$(file_epoch "$PROFILE_EXPIRY_FILE")"; then
    renew_epoch=$(( profile_expiry + RENEW_AFTER_EXPIRY_GRACE_SECONDS ))
    if [ "$renew_epoch" -gt "$now" ]; then
      SCHEDULE_EPOCH="$(ceil_to_next_minute "$renew_epoch")"
      SCHEDULE_REASON="profile expiry"
      RUN_AT_LOAD=0
      return
    fi

    SCHEDULE_EPOCH="$(ceil_to_next_minute "$(( now + RENEW_RETRY_DELAY_SECONDS ))")"
    SCHEDULE_REASON="overdue profile retry"
    RUN_AT_LOAD="$(schedule_run_at_load_value)"
    return
  fi

  SCHEDULE_EPOCH="$(ceil_to_next_minute "$(( now + RENEW_RETRY_DELAY_SECONDS ))")"
  SCHEDULE_REASON="missing profile expiry retry"
  RUN_AT_LOAD="$(schedule_run_at_load_value)"
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
      MARK_SUCCESS_NOW=1
      ;;
    --reschedule-only)
      RESCHEDULE_ONLY=1
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

CONFIG_DEVICE_ID="$(config_value DEVICE_ID || true)"
DEVICE_ID="${DEVICE_ID:-$CONFIG_DEVICE_ID}"

if [ "$UNINSTALL" -eq 1 ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  printf "Removed Daily Kanji LaunchAgent: %s\n" "$PLIST"
  exit 0
fi

if [ -z "$DEVICE_ID" ] && [ "$RESCHEDULE_ONLY" -eq 0 ]; then
  printf "DEVICE_ID is required for install.\n" >&2
  printf "Run: DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh --mark-success-now\n" >&2
  exit 2
fi

if [ -n "$DEVICE_ID" ]; then
  validate_device_id
fi

mkdir -p "$(dirname "$PLIST")" "$STATE_DIR" "$LOG_DIR" "$(dirname "$CONFIG_FILE")"
umask 077
if [ -n "$DEVICE_ID" ]; then
  write_config_value DEVICE_ID "$DEVICE_ID"
fi

if [ "$MARK_SUCCESS_NOW" -eq 1 ]; then
  "$ROOT/scripts/xcode-renew-if-needed.sh" --mark-success-now
fi

compute_schedule
SCHEDULE_MONTH="$(date_component "$SCHEDULE_EPOCH" "+%m")"
SCHEDULE_DAY="$(date_component "$SCHEDULE_EPOCH" "+%d")"
SCHEDULE_HOUR="$(date_component "$SCHEDULE_EPOCH" "+%H")"
SCHEDULE_MINUTE="$(date_component "$SCHEDULE_EPOCH" "+%M")"
SCHEDULE_LABEL="$(date -r "$SCHEDULE_EPOCH" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null || printf "%s" "$SCHEDULE_EPOCH")"
RUN_AT_LOAD_XML=""
if [ "$RUN_AT_LOAD" -eq 1 ]; then
  RUN_AT_LOAD_XML="  <key>RunAtLoad</key>
  <true/>"
fi

PROGRAM="$(escaped "$ROOT/scripts/xcode-renew-if-needed.sh")"
STDOUT_LOG="$(escaped "$LOG_DIR/xcode-renew.out.log")"
STDERR_LOG="$(escaped "$LOG_DIR/xcode-renew.err.log")"
CONFIG_FILE_XML="$(escaped "$CONFIG_FILE")"
DEVELOPER_DIR_XML="$(escaped "${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}")"
PROFILE_EXPIRY_FILE_XML="$(escaped "$PROFILE_EXPIRY_FILE")"
STATE_DIR_XML="$(escaped "$STATE_DIR")"

cat > "$PLIST" <<PLIST
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
    <key>DEVELOPER_DIR</key>
    <string>$DEVELOPER_DIR_XML</string>
    <key>DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD</key>
    <string>1</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PROFILE_EXPIRY_FILE</key>
    <string>$PROFILE_EXPIRY_FILE_XML</string>
    <key>RENEW_MIN_AGE_SECONDS</key>
    <string>$RENEW_MIN_AGE_SECONDS</string>
    <key>RENEW_AFTER_EXPIRY_GRACE_SECONDS</key>
    <string>$RENEW_AFTER_EXPIRY_GRACE_SECONDS</string>
    <key>RENEW_RETRY_DELAY_SECONDS</key>
    <string>$RENEW_RETRY_DELAY_SECONDS</string>
    <key>STATE_DIR</key>
    <string>$STATE_DIR_XML</string>
  </dict>
$RUN_AT_LOAD_XML
  <key>StartCalendarInterval</key>
  <dict>
    <key>Month</key>
    <integer>$SCHEDULE_MONTH</integer>
    <key>Day</key>
    <integer>$SCHEDULE_DAY</integer>
    <key>Hour</key>
    <integer>$SCHEDULE_HOUR</integer>
    <key>Minute</key>
    <integer>$SCHEDULE_MINUTE</integer>
  </dict>
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

plutil -lint "$PLIST" >/dev/null

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
set +e
launchctl bootstrap "gui/$(id -u)" "$PLIST"
BOOTSTRAP_STATUS="$?"
set -e
if [ "$BOOTSTRAP_STATUS" -ne 0 ]; then
  printf "Daily Kanji LaunchAgent bootstrap failed with exit %s for %s\n" "$BOOTSTRAP_STATUS" "$PLIST" >&2
  exit "$BOOTSTRAP_STATUS"
fi

set +e
launchctl enable "gui/$(id -u)/$LABEL"
ENABLE_STATUS="$?"
set -e
if [ "$ENABLE_STATUS" -ne 0 ]; then
  printf "Daily Kanji LaunchAgent enable failed with exit %s for %s\n" "$ENABLE_STATUS" "$LABEL" >&2
  exit "$ENABLE_STATUS"
fi

printf "Installed Daily Kanji LaunchAgent: %s\n" "$PLIST"
printf "Label: %s\n" "$LABEL"
printf "Next scheduled run: %s (%s)\n" "$SCHEDULE_EPOCH" "$SCHEDULE_LABEL"
printf "Schedule reason: %s\n" "$SCHEDULE_REASON"
if [ "$RUN_AT_LOAD" -eq 1 ]; then
  printf "Run at load: yes\n"
else
  printf "Run at load: no\n"
fi
printf "Renew after profile expiry grace: %ss\n" "$RENEW_AFTER_EXPIRY_GRACE_SECONDS"
printf "Retry delay: %ss\n" "$RENEW_RETRY_DELAY_SECONDS"
printf "Config: %s\n" "$CONFIG_FILE"
printf "Logs:\n  %s\n  %s\n" "$LOG_DIR/xcode-renew.out.log" "$LOG_DIR/xcode-renew.err.log"
