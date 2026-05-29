import { describe, expect, it } from "vitest";

import { pickBestBy } from "@/features/shared/model/collections";

describe("pickBestBy", () => {
  it("keeps a falsy value when it is the best candidate", () => {
    const best = pickBestBy([0, 1, 2], (left, right) => left - right);

    expect(best).toBe(0);
  });

  it("keeps null when it is the best candidate", () => {
    const best = pickBestBy<number | null>([null, 1, 2], (left, right) => {
      if (left === right) {
        return 0;
      }

      if (left === null) {
        return -1;
      }

      if (right === null) {
        return 1;
      }

      return left - right;
    });

    expect(best).toBeNull();
  });
});
