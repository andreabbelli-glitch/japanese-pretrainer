import { afterEach, describe, expect, it, vi } from "vitest";

describe("local date cache keys", () => {
  afterEach(() => {
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

    const { getLocalIsoDateKey } = await import("@/lib/local-date");

    expect(getLocalIsoDateKey(new Date("2026-03-11T06:30:00.000Z"))).toBe(
      "2026-03-10"
    );
    expect(getLocalIsoDateKey(new Date("2026-03-11T06:45:00.000Z"))).toBe(
      "2026-03-10"
    );
  });
});
