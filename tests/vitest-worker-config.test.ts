import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultVitestMaxWorkers,
  resolveVitestMaxWorkers
} from "../scripts/vitest-worker-config";

describe("Vitest worker configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to four workers when the override is absent or blank", () => {
    vi.stubEnv("VITEST_MAX_WORKERS", "");

    expect(resolveVitestMaxWorkers()).toBe(defaultVitestMaxWorkers);
    expect(resolveVitestMaxWorkers("  ")).toBe(defaultVitestMaxWorkers);
    expect(defaultVitestMaxWorkers).toBe(4);
  });

  it("reads the process environment when no explicit value is provided", () => {
    vi.stubEnv("VITEST_MAX_WORKERS", "2");

    expect(resolveVitestMaxWorkers()).toBe(2);
  });

  it("accepts a positive integer override", () => {
    expect(resolveVitestMaxWorkers("1")).toBe(1);
    expect(resolveVitestMaxWorkers(" 6 ")).toBe(6);
  });

  it.each(["0", "-1", "1.5", "2workers", "Infinity"])(
    "rejects the invalid override %s",
    (value) => {
      expect(() => resolveVitestMaxWorkers(value)).toThrow(
        "VITEST_MAX_WORKERS must be a positive integer"
      );
    }
  );

  it("rejects integers outside the safe range", () => {
    expect(() => resolveVitestMaxWorkers("9007199254740992")).toThrow(
      "VITEST_MAX_WORKERS exceeds the safe integer range"
    );
  });
});
