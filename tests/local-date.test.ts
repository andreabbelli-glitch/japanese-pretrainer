import { afterEach, describe, expect, it, vi } from "vitest";

import { formatGlossaryShortDate } from "@/lib/glossary-detail-helpers";
import { formatShortIsoDate } from "@/lib/review-queue";

describe("local date formatting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("formats UTC timestamps using the local calendar day", () => {
    const value = "2026-04-10T23:30:00.000Z";

    expect(formatShortIsoDate(value)).toBe("2026-04-11");
    expect(formatGlossaryShortDate(value)).toBe("2026-04-11");
  });

  it("keeps ISO date-only strings stable when the local timezone trails UTC", async () => {
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

    const { formatLocalIsoDate } = await import("@/lib/local-date");

    expect(formatLocalIsoDate("2026-04-10")).toBe("2026-04-10");
  });

  it("does not roll invalid ISO date-only values into a different day", () => {
    expect(formatShortIsoDate("2026-02-30")).toBe("2026-02-30");
    expect(formatGlossaryShortDate("2026-02-30")).toBe("2026-02-30");
  });

  it("falls back to the ISO prefix for invalid dates", () => {
    expect(formatShortIsoDate("not-a-date-value")).toBe("not-a-date");
  });
});
