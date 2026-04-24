import { afterEach, describe, expect, it, vi } from "vitest";

describe("startup instrumentation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/review");
  });

  it("does not block server readiness on the review warm-up", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.doMock("@/lib/review", () => ({
      getGlobalReviewFirstCandidateLoadResult: vi.fn(
        () => new Promise<never>(() => {})
      )
    }));

    const { register } = await import("@/instrumentation");

    expect(register()).toBeUndefined();
  });
});
