import { describe, expect, it } from "vitest";

import {
  formatMediaTypeLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";

describe("study format labels", () => {
  it("formats dedicated web media labels", () => {
    expect(formatMediaTypeLabel("web")).toBe("Web");
    expect(formatSegmentKindLabel("site")).toBe("siti");
  });

  it("keeps fallback capitalization for unknown labels", () => {
    expect(formatMediaTypeLabel("other-media")).toBe("Other Media");
    expect(formatSegmentKindLabel("custom-kind")).toBe("Custom Kind");
  });
});
