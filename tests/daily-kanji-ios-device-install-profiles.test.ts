import { afterEach, describe, expect, it } from "vitest";

import {
  createDeviceInstallFixture,
  type DeviceInstallFixture
} from "./helpers/daily-kanji-ios-device-install";

const fixtures: DeviceInstallFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("Daily Kanji paid provisioning profile verification", () => {
  it("rejects seven-day profiles before installing", async () => {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    const fixture = await createDeviceInstallFixture({
      appExpirationDate: sevenDaysFromNow,
      widgetExpirationDate: sevenDaysFromNow
    });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({
      code: 65,
      stderr: expect.stringContaining("meno di 30 giorni")
    });
    expect((await fixture.readCalls()).join("\n")).not.toContain(
      "device install app"
    );
  });

  it.each([
    {
      label: "team estraneo",
      options: { teamId: "OTHERTEAM1" },
      message: "team"
    },
    {
      label: "bundle app errato",
      options: { appIdentifier: "F5U46464YH.dev.local.wrong" },
      message: "application-identifier"
    },
    {
      label: "device assente",
      options: { devices: ["ANOTHER-DEVICE"] },
      message: "device configurato"
    }
  ])("rejects $label", async ({ options, message }) => {
    const fixture = await createDeviceInstallFixture(options);
    fixtures.push(fixture);

    const failure = expect(fixture.run()).rejects.toMatchObject({
      code: 65,
      stderr: expect.stringContaining(message)
    });
    await failure;
    expect((await fixture.readCalls()).join("\n")).not.toContain(
      "device install app"
    );
  });

  it("requires both app and widget profiles", async () => {
    const fixture = await createDeviceInstallFixture({
      omitWidgetProfile: true
    });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({
      code: 65,
      stderr: expect.stringContaining("attesi esattamente app e widget")
    });
  });
});
