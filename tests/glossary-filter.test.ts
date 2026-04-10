import { describe, expect, it } from "vitest";

import { normalizeGlossaryQuery } from "@/lib/glossary-filter";

describe("normalizeGlossaryQuery", () => {
  it("keeps fully numeric page params", () => {
    expect(
      normalizeGlossaryQuery(
        {
          page: "12"
        },
        "lesson_order"
      )
    ).toMatchObject({
      page: 12
    });
  });

  it("rejects malformed page params instead of partially parsing them", () => {
    expect(
      normalizeGlossaryQuery(
        {
          page: "2abc"
        },
        "lesson_order"
      )
    ).toMatchObject({
      page: 1
    });

    expect(
      normalizeGlossaryQuery(
        {
          page: "1e2"
        },
        "lesson_order"
      )
    ).toMatchObject({
      page: 1
    });
  });
});
