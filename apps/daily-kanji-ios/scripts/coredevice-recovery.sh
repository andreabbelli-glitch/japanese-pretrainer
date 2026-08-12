#!/usr/bin/env bash

# Shared, bounded recovery for the host-side CoreDevice Wi-Fi tunnel. This file
# is sourced by the automatic wrapper and the standalone build/install script.

COREDEVICE_RECOVERY_DELAY_SECONDS="${COREDEVICE_RECOVERY_DELAY_SECONDS:-4}"
DAILY_KANJI_COREDEVICE_RECOVERY_USED="${DAILY_KANJI_COREDEVICE_RECOVERY_USED:-0}"
COREDEVICE_LAST_OUTPUT=""
COREDEVICE_LAST_STATUS=0

coredevice_recovery_validate_settings() {
  if [[ ! "$COREDEVICE_RECOVERY_DELAY_SECONDS" =~ ^[0-9]+$ ]]; then
    printf "Daily Kanji invalid COREDEVICE_RECOVERY_DELAY_SECONDS=%s; expected a non-negative integer.\n" \
      "$COREDEVICE_RECOVERY_DELAY_SECONDS" >&2
    return 78
  fi

  case "$DAILY_KANJI_COREDEVICE_RECOVERY_USED" in
    0|1) ;;
    *)
      printf "Daily Kanji invalid DAILY_KANJI_COREDEVICE_RECOVERY_USED=%s; expected 0 or 1.\n" \
        "$DAILY_KANJI_COREDEVICE_RECOVERY_USED" >&2
      return 78
      ;;
  esac

  export DAILY_KANJI_COREDEVICE_RECOVERY_USED
}

coredevice_output_has_recoverable_tunnel_error() {
  local output="$1"
  local normalized_output

  normalized_output="$(printf "%s" "$output" | LC_ALL=C tr '[:upper:]' '[:lower:]')"

  # These conditions need user action or a later scheduled attempt. They win
  # over the recovery allowlist even if CoreDevice emits a mixed error chain.
  if [[ "$normalized_output" == *"kamdmobileimagemounterdevicelocked"* ]] ||
    [[ "$normalized_output" == *"device is locked"* ]] ||
    [[ "$normalized_output" == *"coredeviceerror error 1011"* ]] ||
    [[ "$normalized_output" == *"unable to locate a device"* ]] ||
    [[ "$normalized_output" == *"not found"* ]] ||
    [[ "$normalized_output" == *"offline"* ]] ||
    [[ "$normalized_output" == *"not paired"* ]] ||
    [[ "$normalized_output" == *"unpaired"* ]] ||
    [[ "$normalized_output" == *"pairing is required"* ]]; then
    return 1
  fi

  [[ "$normalized_output" == *"coredeviceerror error 4000"* ]] ||
    [[ "$normalized_output" == *"coredeviceerror error 0xfa0"* ]] ||
    [[ "$normalized_output" == *"failed to allocate rsd device"* ]] ||
    [[ "$normalized_output" == *"com.apple.mobiledevice error -402653181"* ]] ||
    [[ "$normalized_output" == *"amdevice -402653181"* ]] ||
    [[ "$normalized_output" == *"0xe8000003"* ]] ||
    [[ "$normalized_output" == *"remotepairingerror error 1001"* ]] ||
    [[ "$normalized_output" == *"remotepairingerror error 0x3e9"* ]] ||
    [[ "$normalized_output" == *"timed out while attempting to negotiate tunnel parameters"* ]]
}

coredevice_restart_user_tunnel_services() {
  local launchctl_bin="${COREDEVICE_LAUNCHCTL_BIN:-/bin/launchctl}"
  local user_uid="${COREDEVICE_USER_UID:-$(id -u)}"
  local service
  local status

  DAILY_KANJI_COREDEVICE_RECOVERY_USED=1
  export DAILY_KANJI_COREDEVICE_RECOVERY_USED

  for service in \
    com.apple.CoreDevice.remotepairingd \
    com.apple.CoreDevice.CoreDeviceService; do
    if "$launchctl_bin" kickstart -k "user/$user_uid/$service"; then
      :
    else
      status=$?
      printf "Daily Kanji CoreDevice recovery could not restart %s (exit %s).\n" \
        "$service" "$status" >&2
      return "$status"
    fi
  done

  if [ "$COREDEVICE_RECOVERY_DELAY_SECONDS" -gt 0 ]; then
    sleep "$COREDEVICE_RECOVERY_DELAY_SECONDS"
  fi
}

coredevice_run_with_recovery() {
  local operation="$1"
  local original_status
  shift

  set +e
  COREDEVICE_LAST_OUTPUT="$("$@" 2>&1)"
  COREDEVICE_LAST_STATUS=$?
  set -e
  if [ "$COREDEVICE_LAST_STATUS" -eq 0 ]; then
    return 0
  fi

  original_status="$COREDEVICE_LAST_STATUS"
  if [ "$DAILY_KANJI_COREDEVICE_RECOVERY_USED" = "1" ] ||
    ! coredevice_output_has_recoverable_tunnel_error "$COREDEVICE_LAST_OUTPUT"; then
    return "$COREDEVICE_LAST_STATUS"
  fi

  printf "Daily Kanji detected a stale CoreDevice Wi-Fi tunnel during %s; restarting the two user tunnel services once.\n" \
    "$operation" >&2
  if coredevice_restart_user_tunnel_services; then
    :
  else
    COREDEVICE_LAST_STATUS="$original_status"
    return "$COREDEVICE_LAST_STATUS"
  fi

  set +e
  COREDEVICE_LAST_OUTPUT="$("$@" 2>&1)"
  COREDEVICE_LAST_STATUS=$?
  set -e
  if [ "$COREDEVICE_LAST_STATUS" -eq 0 ]; then
    printf "Daily Kanji CoreDevice Wi-Fi tunnel recovered during %s.\n" "$operation" >&2
    return 0
  fi

  printf "Daily Kanji CoreDevice Wi-Fi tunnel retry still failed during %s (exit %s).\n" \
    "$operation" "$COREDEVICE_LAST_STATUS" >&2
  return "$COREDEVICE_LAST_STATUS"
}
