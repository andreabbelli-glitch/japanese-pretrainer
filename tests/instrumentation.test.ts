import { describe, expect, it } from "vitest";

describe("startup instrumentation", () => {
  it("does not perform speculative database warm-up work", async () => {
    const { register } = await import("@/instrumentation");

    expect(register()).toBeUndefined();
  });
});
