import { readFile, readdir } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDeviceInstallFixture,
  permissions,
  type DeviceInstallFixture
} from "./helpers/daily-kanji-ios-device-install";

const fixtures: DeviceInstallFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("Daily Kanji manual device install", () => {
  it("requires an explicitly configured device", async () => {
    const fixture = await createDeviceInstallFixture({
      configContents: ""
    });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("DEVICE_ID")
    });
  });

  it("rejects a device config readable by group or other users", async () => {
    const fixture = await createDeviceInstallFixture({
      configMode: 0o644
    });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("permessi 0600")
    });
    await expect(fixture.readCalls()).rejects.toThrow(/ENOENT/);
  });

  it("verifies, builds, installs, and launches exactly once", async () => {
    const fixture = await createDeviceInstallFixture();
    fixtures.push(fixture);

    const result = await fixture.run();
    const calls = await fixture.readCalls();

    const listCall = calls.find((call) => call.includes("list devices"));
    expect(calls.filter((call) => call.includes("list devices"))).toHaveLength(
      1
    );
    expect(listCall).toContain("--json-output");
    expect(listCall).not.toContain("--columns");
    const detailsCall = calls.find((call) =>
      call.includes("device info details")
    );
    expect(
      calls.filter((call) => call.includes("device info details"))
    ).toHaveLength(1);
    expect(detailsCall).toContain("--json-output");
    expect(
      calls.filter((call) => call.includes("device info ddiServices"))
    ).toHaveLength(1);
    expect(
      calls.find((call) => call.includes("device info ddiServices"))
    ).toContain("--device ACTIVE-COREDEVICE");
    expect(
      calls.find((call) => call.includes("device info ddiServices"))
    ).toContain("--quiet");
    expect(
      calls.filter((call) => call.startsWith("verify-resources:"))
    ).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("xcodegen:"))).toHaveLength(
      1
    );
    expect(calls.filter((call) => call.startsWith("xcodebuild:"))).toHaveLength(
      1
    );
    expect(calls.join("\n")).toContain("-allowProvisioningUpdates");
    expect(calls.join("\n")).toContain("-allowProvisioningDeviceRegistration");
    expect(calls.join("\n")).toContain("-destination id=TEST-DEVICE");
    expect(
      calls.filter((call) => call.includes("device install app"))
    ).toHaveLength(1);
    expect(calls.find((call) => call.includes("device install app"))).toContain(
      "--device ACTIVE-COREDEVICE"
    );
    expect(calls.find((call) => call.includes("device install app"))).toContain(
      "--quiet"
    );
    expect(
      calls.filter((call) => call.includes("device process launch"))
    ).toHaveLength(1);
    expect(
      calls.find((call) => call.includes("device process launch"))
    ).toContain("--quiet");
    const stageIndexes = [
      "device info details",
      "device info ddiServices",
      "verify-resources:",
      "xcodegen:",
      "xcodebuild:",
      "codesign:",
      "device install app",
      "device process launch"
    ].map((stage) => calls.findIndex((call) => call.includes(stage)));
    expect(stageIndexes.every((index) => index >= 0)).toBe(true);
    expect(stageIndexes).toEqual([...stageIndexes].sort((a, b) => a - b));
    expect(result.stdout).toContain("Tunnel CoreDevice: connected");
    expect(result.stdout).toContain(
      "Installazione Developer Program completata"
    );
    expect(result.stdout).not.toContain("sync//secret");
    expect(result.stdout).not.toContain("mobile//secret");
    expect(result.stdout).not.toContain("TEST-DEVICE");
    expect(result.stdout).not.toContain("ACTIVE-COREDEVICE");
    expect(result.stdout).not.toContain("Andrea Test iPhone");
    expect(result.stderr).not.toContain("sync//secret");
    expect(result.stderr).not.toContain("mobile//secret");
    expect(result.stderr).not.toContain("TEST-DEVICE");
    expect(result.stderr).not.toContain("ACTIVE-COREDEVICE");
    expect(result.stderr).not.toContain("Andrea Test iPhone");
    expect(await readdir(fixture.stateDir)).toEqual(["device.env"]);
    expect(await permissions(fixture.derivedData)).toBe(0o700);

    const xcconfig = await readFile(fixture.capturedXcconfigPath, "utf8");
    expect(xcconfig).toContain("DAILY_KANJI_IOS_SYNC_TOKEN = sync/$()/secret");
    expect(xcconfig).toContain("MOBILE_API_TOKEN = mobile/$()/secret");
  });

  it("repairs an existing DerivedData root to private permissions", async () => {
    const fixture = await createDeviceInstallFixture({
      derivedDataMode: 0o755
    });
    fixtures.push(fixture);

    await fixture.run();

    expect(await permissions(fixture.derivedData)).toBe(0o700);
  });

  it("does not allow legacy environment overrides to weaken paid signing", async () => {
    const fixture = await createDeviceInstallFixture({
      environmentOverrides: {
        CONFIGURATION: "Debug",
        DEVELOPMENT_TEAM: "OTHERTEAM1",
        MIN_PROFILE_VALIDITY_SECONDS: "4102444800",
        SCHEME: "WrongScheme"
      }
    });
    fixtures.push(fixture);

    await fixture.run();
    const calls = (await fixture.readCalls()).join("\n");

    expect(calls).toContain("-scheme DailyKanji");
    expect(calls).toContain("-configuration Release");
    expect(calls).not.toContain("WrongScheme");
    expect(calls).not.toContain("-configuration Debug");
  });

  it("enables push entitlements only through the app target setting", async () => {
    const fixture = await createDeviceInstallFixture({
      configContents: [
        "DEVICE_ID=TEST-DEVICE",
        "DAILY_KANJI_ENABLE_APNS=1",
        ""
      ].join("\n")
    });
    fixtures.push(fixture);

    await fixture.run();
    const xcconfig = await readFile(fixture.capturedXcconfigPath, "utf8");

    expect(xcconfig).toContain(
      "DAILY_KANJI_APP_ENTITLEMENTS = DailyKanjiPush.entitlements"
    );
    expect(xcconfig).not.toMatch(/^CODE_SIGN_ENTITLEMENTS\s*=/m);
  });

  it("moves environment overrides into xcconfig without exporting them to child processes", async () => {
    const fixture = await createDeviceInstallFixture({
      configContents: ["DEVICE_ID=TEST-DEVICE", ""].join("\n"),
      environmentOverrides: {
        DAILY_KANJI_IOS_SYNC_ENDPOINT: "https://env-sync.example.test/dataset",
        DAILY_KANJI_IOS_SYNC_TOKEN: "env-sync-secret",
        MOBILE_API_ENDPOINT: "https://env-mobile.example.test/api",
        MOBILE_API_TOKEN: "env-mobile-secret"
      }
    });
    fixtures.push(fixture);

    const result = await fixture.run();
    const xcconfig = await readFile(fixture.capturedXcconfigPath, "utf8");

    expect(xcconfig).toContain("DAILY_KANJI_IOS_SYNC_TOKEN = env-sync-secret");
    expect(xcconfig).toContain("MOBILE_API_TOKEN = env-mobile-secret");
    expect(result.stdout).not.toContain("env-sync-secret");
    expect(result.stdout).not.toContain("env-mobile-secret");
    expect(result.stderr).not.toContain("private environment leaked");
  });

  it("rejects incomplete private API pairs before contacting the device", async () => {
    const fixture = await createDeviceInstallFixture({
      configContents: [
        "DEVICE_ID=TEST-DEVICE",
        "DAILY_KANJI_IOS_SYNC_ENDPOINT=https://sync.example.test/dataset",
        ""
      ].join("\n")
    });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        "DAILY_KANJI_IOS_SYNC_ENDPOINT e DAILY_KANJI_IOS_SYNC_TOKEN"
      )
    });
    await expect(fixture.readCalls()).rejects.toThrow(/ENOENT/);
  });
});
