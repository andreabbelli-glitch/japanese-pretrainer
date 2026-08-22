import { afterEach, describe, expect, it } from "vitest";

import {
  createDeviceInstallFixture,
  type DeviceInstallFixture
} from "./helpers/daily-kanji-ios-device-install";

const fixtures: DeviceInstallFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("Daily Kanji manual install failure boundaries", () => {
  it("stops when packaged resources are invalid", async () => {
    const fixture = await createDeviceInstallFixture({ resourceExit: 47 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 47 });
    const calls = await fixture.readCalls();
    expect(calls.join("\n")).toContain("verify-resources:");
    expect(calls.join("\n")).not.toContain("xcodegen:");
  });

  it("stops when XcodeGen fails", async () => {
    const fixture = await createDeviceInstallFixture({ xcodegenExit: 48 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 48 });
    expect((await fixture.readCalls()).join("\n")).not.toContain("xcodebuild:");
  });

  it("reports signing guidance without attempting install", async () => {
    const fixture = await createDeviceInstallFixture({ buildExit: 49 });
    fixtures.push(fixture);

    const failure = await fixture.run().then(
      () => {
        throw new Error("expected xcodebuild failure");
      },
      (error: unknown) => error as { code: number; stderr: string }
    );
    expect(failure).toMatchObject({
      code: 49,
      stderr: expect.stringContaining("Apple Developer Program")
    });
    expect(failure.stderr).not.toContain("sync//secret");
    expect(failure.stderr).not.toContain("sync/$()/secret");
    expect(failure.stderr).not.toContain("mobile//secret");
    expect(failure.stderr).not.toContain("mobile/$()/secret");
    expect(failure.stderr).not.toContain("sync.example.test");
    expect(failure.stderr).not.toContain("mobile.example.test");
    expect((await fixture.readCalls()).join("\n")).not.toContain(
      "device install app"
    );
  });

  it("stops before install when deep signature verification fails", async () => {
    const fixture = await createDeviceInstallFixture({ codesignExit: 50 });
    fixtures.push(fixture);

    await expect(fixture.run()).rejects.toMatchObject({ code: 50 });
    expect((await fixture.readCalls()).join("\n")).not.toContain(
      "device install app"
    );
  });
});
