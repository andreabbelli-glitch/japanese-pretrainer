import { afterEach, describe, expect, it } from "vitest";

import {
  createDeviceInstallFixture,
  type DeviceInstallFixture
} from "./helpers/daily-kanji-ios-device-install";

const fixtures: DeviceInstallFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("Daily Kanji one-shot CoreDevice install", () => {
  it.each(["localNetwork", "wired"] as const)(
    "accepts the %s CoreDevice transport",
    async (transportType) => {
      const fixture = await createDeviceInstallFixture({ transportType });
      fixtures.push(fixture);

      const result = await fixture.run();

      expect(result.stdout).toContain(
        "Installazione Developer Program completata"
      );
    }
  );

  it("does not retry or build when the device is offline", async () => {
    const fixture = await createDeviceInstallFixture({ detailsExit: 44 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 44 });
    const calls = await fixture.readCalls();
    expect(
      calls.filter((call) => call.includes("device info details"))
    ).toHaveLength(1);
    expect(calls.join("\n")).not.toContain("verify-resources:");
    expect(calls.join("\n")).not.toContain("xcodebuild:");
  });

  it("stops before build when the developer disk image is unavailable", async () => {
    const fixture = await createDeviceInstallFixture({ ddiExit: 45 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 45 });
    const calls = await fixture.readCalls();
    expect(
      calls.filter((call) => call.includes("device info ddiServices"))
    ).toHaveLength(1);
    expect(calls.join("\n")).not.toContain("xcodebuild:");
  });

  it("does not launch after an install failure", async () => {
    const fixture = await createDeviceInstallFixture({ installExit: 46 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 46 });
    const calls = await fixture.readCalls();
    expect(
      calls.filter((call) => call.includes("device install app"))
    ).toHaveLength(1);
    expect(calls.join("\n")).not.toContain("device process launch");
  });
});
