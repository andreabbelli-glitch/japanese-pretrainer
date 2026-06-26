#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${LABEL:-dev.local.daily-kanji.renew}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/DailyKanji}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/DailyKanji}"
CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"
DEVICE_ID="${DEVICE_ID:-}"
START_INTERVAL_SECONDS="${START_INTERVAL_SECONDS:-21600}"
RENEW_MIN_AGE_SECONDS="${RENEW_MIN_AGE_SECONDS:-432000}"
MARK_SUCCESS_NOW=0
UNINSTALL=0

usage() {
  cat <<'USAGE'
Usage: install-renew-launchd.sh [--device-id <id>] [--mark-success-now] [--uninstall]

Installs a user LaunchAgent that periodically runs xcode-renew-if-needed.sh.
The agent checks every START_INTERVAL_SECONDS, but the wrapper only performs
the expensive renew/install after RENEW_MIN_AGE_SECONDS since the last success.
The device id is stored in a local, untracked config file.

Environment:
  DEVICE_ID                  CoreDevice identifier of the target iPhone.
  CONFIG_FILE                Default: ~/Library/Application Support/DailyKanji/renew.env.
  START_INTERVAL_SECONDS      Default: 21600 (6 hours).
  RENEW_MIN_AGE_SECONDS       Default: 432000 (5 days).
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

if [ -z "$DEVICE_ID" ]; then
  printf "DEVICE_ID is required for install.\n" >&2
  printf "Run: DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh --mark-success-now\n" >&2
  exit 2
fi

validate_device_id

mkdir -p "$(dirname "$PLIST")" "$STATE_DIR" "$LOG_DIR" "$(dirname "$CONFIG_FILE")"
umask 077
write_config_value DEVICE_ID "$DEVICE_ID"

if [ "$MARK_SUCCESS_NOW" -eq 1 ]; then
  "$ROOT/scripts/xcode-renew-if-needed.sh" --mark-success-now
fi

PROGRAM="$(escaped "$ROOT/scripts/xcode-renew-if-needed.sh")"
STDOUT_LOG="$(escaped "$LOG_DIR/xcode-renew.out.log")"
STDERR_LOG="$(escaped "$LOG_DIR/xcode-renew.err.log")"
CONFIG_FILE_XML="$(escaped "$CONFIG_FILE")"
DEVELOPER_DIR_XML="$(escaped "${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}")"

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
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>RENEW_MIN_AGE_SECONDS</key>
    <string>$RENEW_MIN_AGE_SECONDS</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>$START_INTERVAL_SECONDS</integer>
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
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

printf "Installed Daily Kanji LaunchAgent: %s\n" "$PLIST"
printf "Label: %s\n" "$LABEL"
printf "Check interval: %ss\n" "$START_INTERVAL_SECONDS"
printf "Renew min age: %ss\n" "$RENEW_MIN_AGE_SECONDS"
printf "Config: %s\n" "$CONFIG_FILE"
printf "Logs:\n  %s\n  %s\n" "$LOG_DIR/xcode-renew.out.log" "$LOG_DIR/xcode-renew.err.log"
