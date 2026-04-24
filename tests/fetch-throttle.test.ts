import { afterEach, describe, expect, it, vi } from "vitest";

import { createFetchThrottle } from "@/lib/fetch-throttle";

describe("fetch throttle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cancels retryable response bodies before retrying", async () => {
    const cancelBody = vi.fn().mockResolvedValue(undefined);
    const retryableResponse = {
      body: {
        cancel: cancelBody
      },
      headers: new Headers(),
      ok: false,
      status: 503,
      statusText: "Service Unavailable"
    } as unknown as Response;
    const successResponse = {
      ok: true
    } as Response;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(retryableResponse)
      .mockResolvedValueOnce(successResponse);
    const throttle = createFetchThrottle({
      maxRetries: 1,
      requestDelayMs: 0,
      requestTimeoutMs: 1_000,
      retryBaseDelayMs: 0
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      throttle.fetchWithRetry("https://example.test/audio.ogg")
    ).resolves.toBe(successResponse);

    expect(cancelBody).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels failed response bodies before throwing", async () => {
    const cancelBody = vi.fn().mockResolvedValue(undefined);
    const failedResponse = {
      body: {
        cancel: cancelBody
      },
      headers: new Headers(),
      ok: false,
      status: 404,
      statusText: "Not Found"
    } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValueOnce(failedResponse);
    const throttle = createFetchThrottle({
      maxRetries: 0,
      requestDelayMs: 0,
      requestTimeoutMs: 1_000,
      retryBaseDelayMs: 0
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      throttle.fetchWithRetry("https://example.test/missing.ogg")
    ).rejects.toThrow(
      "Failed to fetch https://example.test/missing.ogg: 404 Not Found"
    );

    expect(cancelBody).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
