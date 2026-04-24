import { afterEach, describe, expect, it, vi } from "vitest";

import { createFetchThrottle } from "@/lib/fetch-throttle";

describe("fetch throttle", () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it("serializes calls already waiting for the next throttle slot", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-24T12:00:00.000Z");
    vi.setSystemTime(start);
    const fetchStartTimes: number[] = [];
    const successResponse = {
      ok: true
    } as Response;
    const fetchMock = vi.fn(async () => {
      fetchStartTimes.push(Date.now());
      return successResponse;
    });
    const throttle = createFetchThrottle({
      requestDelayMs: 1_000,
      requestTimeoutMs: 10_000
    });

    vi.stubGlobal("fetch", fetchMock);

    const firstFetch = throttle.throttledFetch("https://example.test/one.ogg");
    const secondFetch = throttle.throttledFetch("https://example.test/two.ogg");
    const thirdFetch = throttle.throttledFetch("https://example.test/three.ogg");

    expect(fetchStartTimes).toEqual([start.getTime()]);

    await vi.advanceTimersByTimeAsync(999);

    expect(fetchStartTimes).toEqual([start.getTime()]);

    await vi.advanceTimersByTimeAsync(1);

    expect(fetchStartTimes).toEqual([start.getTime(), start.getTime() + 1_000]);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(
      Promise.all([firstFetch, secondFetch, thirdFetch])
    ).resolves.toEqual([successResponse, successResponse, successResponse]);

    expect(fetchStartTimes).toEqual([
      start.getTime(),
      start.getTime() + 1_000,
      start.getTime() + 2_000
    ]);
  });
});
