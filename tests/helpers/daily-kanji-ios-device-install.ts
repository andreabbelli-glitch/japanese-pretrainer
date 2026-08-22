import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceInstallScriptPath = path.join(
  process.cwd(),
  "apps",
  "daily-kanji-ios",
  "scripts",
  "install-device.sh"
);
const privateEnvironmentGuard = [
  "for private_key in DEVICE_ID DAILY_KANJI_IOS_SYNC_ENDPOINT DAILY_KANJI_IOS_SYNC_TOKEN MOBILE_API_ENDPOINT MOBILE_API_TOKEN DAILY_KANJI_ENABLE_APNS COREDEVICE_ID PROFILE_DEVICE_ID DEVICE_NAME; do",
  '  if [ -n "${!private_key:-}" ]; then',
  '    echo "private environment leaked: $private_key" >&2',
  "    exit 96",
  "  fi",
  "done"
];

export interface DeviceInstallFixtureOptions {
  appExpirationDate?: string;
  appIdentifier?: string;
  buildExit?: number;
  codesignExit?: number;
  configMode?: number;
  configContents?: string;
  detailsExit?: number;
  ddiExit?: number;
  derivedDataMode?: number;
  devices?: string[];
  environmentOverrides?: Record<string, string>;
  installExit?: number;
  launchExit?: number;
  omitWidgetProfile?: boolean;
  resourceExit?: number;
  resolvedDeviceId?: string;
  teamId?: string;
  transportType?: "localNetwork" | "wired";
  widgetExpirationDate?: string;
  widgetIdentifier?: string;
  xcodegenExit?: number;
}

export interface DeviceInstallFixture {
  appPath: string;
  capturedXcconfigPath: string;
  cleanup(): Promise<void>;
  configFile: string;
  derivedData: string;
  readCalls(): Promise<string[]>;
  run(): ReturnType<typeof execFileAsync>;
  stateDir: string;
}

export const paidExpirationDate = "2099-06-10T15:29:52Z";

export async function createDeviceInstallFixture(
  options: DeviceInstallFixtureOptions = {}
): Promise<DeviceInstallFixture> {
  const tempRoot = await mkdtemp(
    path.join(tmpdir(), "jcs-daily-kanji-device-install-")
  );
  const repoRoot = path.join(tempRoot, "repo");
  const iosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
  const iosScriptsRoot = path.join(iosRoot, "scripts");
  const repoScriptsRoot = path.join(repoRoot, "scripts");
  const binDir = path.join(tempRoot, "bin");
  const stateDir = path.join(tempRoot, "state");
  const derivedData = path.join(tempRoot, "DerivedData");
  const appPath = path.join(
    derivedData,
    "Build",
    "Products",
    "Release-iphoneos",
    "Daily Kanji.app"
  );
  const widgetPath = path.join(appPath, "PlugIns", "Daily Kanji Widget.appex");
  const configFile = path.join(stateDir, "device.env");
  const callLogPath = path.join(tempRoot, "calls.log");
  const capturedXcconfigPath = path.join(tempRoot, "captured.xcconfig");
  const appProfilePlistPath = path.join(tempRoot, "app-profile.plist");
  const widgetProfilePlistPath = path.join(tempRoot, "widget-profile.plist");
  const installScriptPath = path.join(iosScriptsRoot, "install-device.sh");
  const teamId = options.teamId ?? "F5U46464YH";
  const devices = options.devices ?? ["TEST-DEVICE"];

  await mkdir(iosScriptsRoot, { recursive: true });
  await mkdir(repoScriptsRoot, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    installScriptPath,
    await readFile(sourceInstallScriptPath, "utf8")
  );
  await chmod(installScriptPath, 0o755);
  await writeFile(
    configFile,
    options.configContents ??
      [
        "DEVICE_ID=TEST-DEVICE",
        "DAILY_KANJI_IOS_SYNC_ENDPOINT=https://sync.example.test/dataset",
        "DAILY_KANJI_IOS_SYNC_TOKEN=sync//secret",
        "MOBILE_API_ENDPOINT=https://mobile.example.test/api",
        "MOBILE_API_TOKEN=mobile//secret",
        ""
      ].join("\n")
  );
  await chmod(configFile, options.configMode ?? 0o600);
  if (options.derivedDataMode !== undefined) {
    await mkdir(derivedData, { recursive: true });
    await chmod(derivedData, options.derivedDataMode);
  }
  await writeFile(
    appProfilePlistPath,
    provisioningProfilePlist({
      applicationIdentifier:
        options.appIdentifier ?? `${teamId}.dev.local.daily-kanji`,
      devices,
      expirationDate: options.appExpirationDate ?? paidExpirationDate,
      name: "iOS Team Provisioning Profile: dev.local.daily-kanji",
      teamId,
      uuid: "11111111-1111-4111-8111-111111111111"
    })
  );
  await writeFile(
    widgetProfilePlistPath,
    provisioningProfilePlist({
      applicationIdentifier:
        options.widgetIdentifier ?? `${teamId}.dev.local.daily-kanji.widget`,
      devices,
      expirationDate: options.widgetExpirationDate ?? paidExpirationDate,
      name: "iOS Team Provisioning Profile: dev.local.daily-kanji.widget",
      teamId,
      uuid: "22222222-2222-4222-8222-222222222222"
    })
  );

  await writeExecutable(
    path.join(repoScriptsRoot, "with-node.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'printf "verify-resources:%s\\n" "$*" >> "$CALL_LOG"',
      'exit "${RESOURCE_EXIT:-0}"'
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodegen"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'printf "xcodegen:%s\\n" "$*" >> "$CALL_LOG"',
      'exit "${XCODEGEN_EXIT:-0}"'
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodebuild"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'printf "xcodebuild:%s\\n" "$*" >> "$CALL_LOG"',
      'previous=""',
      'for argument in "$@"; do',
      '  if [ "$previous" = "-xcconfig" ]; then',
      '    cp "$argument" "$CAPTURED_XCCONFIG"',
      "  fi",
      '  previous="$argument"',
      "done",
      'if [ "${BUILD_EXIT:-0}" -ne 0 ]; then',
      "  printf '%s\\n' 'diagnostic: https://sync.example.test/dataset sync//secret https:/$()/sync.example.test/dataset sync/$()/secret https://mobile.example.test/api mobile//secret https:/$()/mobile.example.test/api mobile/$()/secret' >&2",
      '  echo "No profiles for dev.local.daily-kanji were found" >&2',
      '  exit "$BUILD_EXIT"',
      "fi",
      'mkdir -p "$FAKE_WIDGET_PATH"',
      ': > "$FAKE_APP_PATH/embedded.mobileprovision"',
      'if [ "${OMIT_WIDGET_PROFILE:-0}" -eq 0 ]; then',
      '  : > "$FAKE_WIDGET_PATH/embedded.mobileprovision"',
      "fi"
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "xcrun"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
      'json_output=""',
      'previous=""',
      'for argument in "$@"; do',
      '  if [ "$previous" = "--json-output" ]; then',
      '    json_output="$argument"',
      "  fi",
      '  previous="$argument"',
      "done",
      'case "$*" in',
      '  *"devicectl list devices"*)',
      '    if [ -z "$json_output" ]; then',
      '      echo "missing --json-output" >&2',
      "      exit 98",
      "    fi",
      '    printf \'{"info":{"outcome":"success"},"result":{"devices":[{"identifier":"%s","hardwareProperties":{"udid":"%s"},"deviceProperties":{"name":"Andrea Test iPhone"},"connectionProperties":{"transportType":"%s"}}]}}\\n\' "${MOCK_RESOLVED_DEVICE_ID:-ACTIVE-COREDEVICE}" "${MOCK_PROFILE_DEVICE_ID:-TEST-DEVICE}" "${MOCK_TRANSPORT_TYPE:-localNetwork}" > "$json_output"',
      "    ;;",
      '  *"device info details"*)',
      '    if [ "${DETAILS_EXIT:-0}" -ne 0 ]; then',
      '      echo "device unavailable" >&2',
      '      exit "$DETAILS_EXIT"',
      "    fi",
      '    if [ -z "$json_output" ]; then',
      '      echo "missing --json-output" >&2',
      "      exit 98",
      "    fi",
      '    printf \'{"info":{"outcome":"success"},"result":{"identifier":"%s","hardwareProperties":{"udid":"%s"},"deviceProperties":{"name":"Andrea Test iPhone"},"connectionProperties":{"transportType":"%s","tunnelState":"connected"}}}\\n\' "${MOCK_RESOLVED_DEVICE_ID:-ACTIVE-COREDEVICE}" "${MOCK_PROFILE_DEVICE_ID:-TEST-DEVICE}" "${MOCK_TRANSPORT_TYPE:-localNetwork}" > "$json_output"',
      "    ;;",
      '  *"device info ddiServices"*)',
      '    if [ "${DDI_EXIT:-0}" -ne 0 ]; then',
      '      echo "device is locked" >&2',
      '      exit "$DDI_EXIT"',
      "    fi",
      '    echo "Developer Disk Image services information for Andrea Test iPhone"',
      "    ;;",
      '  *"device install app"*)',
      '    if [ "${INSTALL_EXIT:-0}" -ne 0 ]; then',
      '      echo "install failed" >&2',
      '      exit "$INSTALL_EXIT"',
      "    fi",
      '    echo "Installed application on Andrea Test iPhone"',
      "    ;;",
      '  *"device process launch"*)',
      '    if [ "${LAUNCH_EXIT:-0}" -ne 0 ]; then',
      '      echo "launch failed" >&2',
      '      exit "$LAUNCH_EXIT"',
      "    fi",
      '    echo "Launched application on Andrea Test iPhone"',
      "    ;;",
      "  *)",
      '    echo "unexpected xcrun invocation: $*" >&2',
      "    exit 97",
      "    ;;",
      "esac"
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "security"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'profile_path="${@: -1}"',
      'if [[ "$profile_path" == *"Widget"* ]]; then',
      '  cat "$WIDGET_PROFILE_PLIST"',
      "else",
      '  cat "$APP_PROFILE_PLIST"',
      "fi"
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "codesign"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      ...privateEnvironmentGuard,
      'printf "codesign:%s\\n" "$*" >> "$CALL_LOG"',
      'exit "${CODESIGN_EXIT:-0}"'
    ].join("\n") + "\n"
  );

  return {
    appPath,
    capturedXcconfigPath,
    async cleanup() {
      await rm(tempRoot, { force: true, recursive: true });
    },
    configFile,
    derivedData,
    async readCalls() {
      return (await readFile(callLogPath, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean);
    },
    run() {
      return execFileAsync("bash", [installScriptPath], {
        cwd: "/",
        env: {
          ...process.env,
          APP_PROFILE_PLIST: appProfilePlistPath,
          BUILD_EXIT: String(options.buildExit ?? 0),
          CALL_LOG: callLogPath,
          CAPTURED_XCCONFIG: capturedXcconfigPath,
          CODESIGN_EXIT: String(options.codesignExit ?? 0),
          CONFIGURATION: "",
          COREDEVICE_ID: "EXPORTED-COREDEVICE",
          DAILY_KANJI_ENABLE_APNS: "",
          DAILY_KANJI_IOS_SYNC_ENDPOINT: "",
          DAILY_KANJI_IOS_SYNC_TOKEN: "",
          DEVELOPMENT_TEAM: "",
          DDI_EXIT: String(options.ddiExit ?? 0),
          DERIVED_DATA: derivedData,
          DETAILS_EXIT: String(options.detailsExit ?? 0),
          DEVICE_CONFIG_FILE: configFile,
          DEVICE_NAME: "Exported Device Name",
          FAKE_APP_PATH: appPath,
          FAKE_WIDGET_PATH: widgetPath,
          HOME: path.join(tempRoot, "home"),
          INSTALL_EXIT: String(options.installExit ?? 0),
          LAUNCH_EXIT: String(options.launchExit ?? 0),
          MIN_PROFILE_VALIDITY_SECONDS: "",
          MOBILE_API_ENDPOINT: "",
          MOBILE_API_TOKEN: "",
          OMIT_WIDGET_PROFILE: options.omitWidgetProfile ? "1" : "0",
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          MOCK_PROFILE_DEVICE_ID: "TEST-DEVICE",
          PROFILE_DEVICE_ID: "EXPORTED-PROFILE-DEVICE",
          RESOURCE_EXIT: String(options.resourceExit ?? 0),
          MOCK_RESOLVED_DEVICE_ID:
            options.resolvedDeviceId ?? "ACTIVE-COREDEVICE",
          MOCK_TRANSPORT_TYPE: options.transportType ?? "localNetwork",
          STATE_DIR: stateDir,
          WIDGET_PROFILE_PLIST: widgetProfilePlistPath,
          XCODEGEN_EXIT: String(options.xcodegenExit ?? 0),
          ...options.environmentOverrides
        }
      });
    },
    stateDir
  };
}

export async function permissions(filePath: string): Promise<number> {
  return (await stat(filePath)).mode & 0o777;
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}

function provisioningProfilePlist(input: {
  applicationIdentifier: string;
  devices: string[];
  expirationDate: string;
  name: string;
  teamId: string;
  uuid: string;
}) {
  const deviceRows = input.devices
    .map((device) => `    <string>${device}</string>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Name</key>",
    `  <string>${input.name}</string>`,
    "  <key>TeamName</key>",
    "  <string>Andrea Belli</string>",
    "  <key>TeamIdentifier</key>",
    "  <array>",
    `    <string>${input.teamId}</string>`,
    "  </array>",
    "  <key>UUID</key>",
    `  <string>${input.uuid}</string>`,
    "  <key>CreationDate</key>",
    "  <date>2026-08-22T10:00:00Z</date>",
    "  <key>ExpirationDate</key>",
    `  <date>${input.expirationDate}</date>`,
    "  <key>ProvisionedDevices</key>",
    "  <array>",
    deviceRows,
    "  </array>",
    "  <key>Entitlements</key>",
    "  <dict>",
    "    <key>application-identifier</key>",
    `    <string>${input.applicationIdentifier}</string>`,
    "  </dict>",
    "</dict>",
    "</plist>",
    ""
  ].join("\n");
}
