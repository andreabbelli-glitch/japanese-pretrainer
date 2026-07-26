import { afterEach, describe, expect, it, vi } from "vitest";

describe("local date cache keys", () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("keeps the same local-day key across a UTC midnight when the local day has not changed", async () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;

    class MockDateTimeFormat extends RealDateTimeFormat {
      constructor(
        locales?: ConstructorParameters<typeof Intl.DateTimeFormat>[0],
        options?: ConstructorParameters<typeof Intl.DateTimeFormat>[1]
      ) {
        super(locales, {
          ...options,
          timeZone: "America/Los_Angeles"
        });
      }
    }

    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: MockDateTimeFormat
    });

    const { getLocalIsoDateKey } =
      await import("@/features/shared/model/local-date");

    expect(getLocalIsoDateKey(new Date("2026-03-11T06:30:00.000Z"))).toBe(
      "2026-03-10"
    );
    expect(getLocalIsoDateKey(new Date("2026-03-11T06:45:00.000Z"))).toBe(
      "2026-03-10"
    );
  });

  it("uses monotonic buckets across the repeated local hour at the end of DST", async () => {
    process.env.TZ = "Europe/Rome";
    const { getLocalIsoTimeBucketKey } =
      await import("@/features/shared/model/local-date");

    const firstLocalTwoOClock = getLocalIsoTimeBucketKey(
      new Date("2026-10-25T00:05:00.000Z")
    );
    const repeatedLocalTwoOClock = getLocalIsoTimeBucketKey(
      new Date("2026-10-25T01:05:00.000Z")
    );

    expect(firstLocalTwoOClock).not.toBe(repeatedLocalTwoOClock);
    expect(getLocalIsoTimeBucketKey(new Date("2026-10-25T00:09:59.999Z"))).toBe(
      firstLocalTwoOClock
    );
  });
});
