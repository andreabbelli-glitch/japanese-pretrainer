import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGlobalGlossaryAutocompleteDataMock } = vi.hoisted(() => ({
  getGlobalGlossaryAutocompleteDataMock: vi.fn()
}));

vi.mock("@/features/glossary/server", () => ({
  getGlobalGlossaryAutocompleteData: getGlobalGlossaryAutocompleteDataMock
}));

import { GET } from "@/app/api/glossary/autocomplete/route";

describe("glossary autocomplete route", () => {
  beforeEach(() => {
    getGlobalGlossaryAutocompleteDataMock.mockReset();
  });

  it("preserves duplicated query params so downstream normalization can skip bad values", async () => {
    getGlobalGlossaryAutocompleteDataMock.mockResolvedValue([
      { label: "余白", resultKey: "term:group:margin" }
    ]);

    const response = await GET(
      new Request(
        "https://example.test/api/glossary/autocomplete?cards=invalid&cards=with_cards&q=&q=yohaku&study=bad&study=learning&type=wrong&type=term"
      )
    );

    expect(getGlobalGlossaryAutocompleteDataMock).toHaveBeenCalledWith({
      cards: ["invalid", "with_cards"],
      media: undefined,
      q: "yohaku",
      study: ["bad", "learning"],
      type: ["wrong", "term"]
    });
    await expect(response.json()).resolves.toEqual([
      { label: "余白", resultKey: "term:group:margin" }
    ]);
  });
});
