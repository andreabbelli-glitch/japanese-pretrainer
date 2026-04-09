import { describe, expect, it } from "vitest";

import { romanizeKanaForSearch } from "@/lib/study-search";

describe("study search", () => {
  it("romanizes ツァ-series loanword digraphs without inserting an extra u", () => {
    expect(romanizeKanaForSearch("ぱんつぁー")).toBe("pantsaa");
    expect(romanizeKanaForSearch("パンツェル")).toBe("pantseru");
  });
});
