import { describe, expect, it } from "vitest";

import { createDeferred, flushMicrotasks, waitForTruthy } from "./async";

describe("async test helpers", () => {
  it("resolves deferred promises with the provided value", async () => {
    const deferred = createDeferred<string>();

    deferred.resolve("ready");

    await expect(deferred.promise).resolves.toBe("ready");
  });

  it("rejects deferred promises with the provided reason", async () => {
    const deferred = createDeferred<string>();

    deferred.reject(new Error("not ready"));

    await expect(deferred.promise).rejects.toThrow("not ready");
  });

  it("flushes the requested number of microtask cycles", async () => {
    const events: string[] = [];

    Promise.resolve().then(() => {
      events.push("first");
      Promise.resolve().then(() => {
        events.push("second");
      });
    });

    await flushMicrotasks(2);

    expect(events).toEqual(["first", "second"]);
  });

  it("waits until a predicate becomes true", async () => {
    let attempts = 0;

    await waitForTruthy(() => {
      attempts += 1;
      return attempts === 3;
    }, "predicate did not become true");

    expect(attempts).toBe(3);
  });

  it("throws the provided message when the predicate never becomes true", async () => {
    await expect(
      waitForTruthy(() => false, "custom timeout", {
        attempts: 2
      })
    ).rejects.toThrow("custom timeout");
  });
});
