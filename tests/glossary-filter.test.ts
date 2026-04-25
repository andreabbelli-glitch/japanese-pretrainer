import { describe, expect, it } from "vitest";

import { normalizeGlossaryQuery } from "@/features/glossary/model/filter";

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

  it("keeps the first non-empty duplicated search param when arrays start empty", () => {
    expect(
      normalizeGlossaryQuery(
        {
          page: ["", "12"],
          q: ["   ", "iku"],
          study: ["", "learning"]
        },
        "lesson_order"
      )
    ).toMatchObject({
      page: 12,
      query: "iku",
      study: "learning"
    });
  });

  it("skips invalid duplicated filters until it finds a valid glossary value", () => {
    expect(
      normalizeGlossaryQuery(
        {
          cards: ["invalid", "with_cards"],
          page: ["oops", "12"],
          sort: ["newest", "alphabetical"],
          study: ["bad", "learning"],
          type: ["wrong", "term"]
        },
        "lesson_order"
      )
    ).toMatchObject({
      cards: "with_cards",
      entryType: "term",
      page: 12,
      sort: "alphabetical",
      study: "learning"
    });
  });
});
