import { describe, expect, it } from "vitest";

import { pickBestBy } from "@/lib/collections";

describe("pickBestBy", () => {
  it("keeps a falsy value when it is the best candidate", () => {
    const best = pickBestBy([0, 1, 2], (left, right) => left - right);

    expect(best).toBe(0);
  });
});
