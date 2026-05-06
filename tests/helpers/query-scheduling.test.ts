import { describe, expect, it } from "vitest";

import { createQuerySchedulingHarness } from "./query-scheduling";

describe("query scheduling harness", () => {
  it("tracks gated query starts and settlement", async () => {
    const schedule = createQuerySchedulingHarness();
    const media = schedule.gate<Array<{ id: string }>>("media");

    const loadPromise = media.loader([{ id: "media-1" }])();

    await schedule.expectStarted("media");
    schedule.expectNotSettled("media");

    media.resolve();

    await expect(loadPromise).resolves.toEqual([{ id: "media-1" }]);
  });

  it("asserts a result can resolve while another gate is blocked", async () => {
    const schedule = createQuerySchedulingHarness();
    const settings = schedule.gate<"hover">("settings");

    const resultPromise = Promise.resolve("cache-hit");

    await schedule.expectResolvesWhileBlocked(resultPromise, "settings");
    schedule.expectNotStarted("settings");

    settings.resolve("hover");
    await schedule.releaseAll();
  });
});
