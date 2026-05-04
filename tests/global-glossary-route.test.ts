import { describe, expect, it, vi } from "vitest";

const {
  getGlobalGrammarGlossaryDetailDataMock,
  getGlobalTermGlossaryDetailDataMock,
  notFoundMock
} = vi.hoisted(() => ({
  getGlobalGrammarGlossaryDetailDataMock: vi.fn(),
  getGlobalTermGlossaryDetailDataMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  })
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

vi.mock("@/features/glossary/server", () => ({
  getGlobalGrammarGlossaryDetailData: getGlobalGrammarGlossaryDetailDataMock,
  getGlobalTermGlossaryDetailData: getGlobalTermGlossaryDetailDataMock
}));

import GlobalGlossaryGrammarRoute from "@/app/glossary/grammar/[surface]/page";
import GlobalGlossaryTermRoute from "@/app/glossary/term/[surface]/page";

describe("global glossary detail routes", () => {
  it("keeps already-decoded literal percent surfaces instead of throwing", async () => {
    const searchParams = {};
    getGlobalTermGlossaryDetailDataMock.mockResolvedValueOnce({});
    getGlobalGrammarGlossaryDetailDataMock.mockResolvedValueOnce({});

    await expect(
      GlobalGlossaryTermRoute({
        params: Promise.resolve({
          surface: "100%"
        }),
        searchParams: Promise.resolve(searchParams)
      })
    ).resolves.toBeDefined();
    await expect(
      GlobalGlossaryGrammarRoute({
        params: Promise.resolve({
          surface: "100%"
        }),
        searchParams: Promise.resolve(searchParams)
      })
    ).resolves.toBeDefined();

    expect(getGlobalTermGlossaryDetailDataMock).toHaveBeenCalledWith(
      "100%",
      searchParams
    );
    expect(getGlobalGrammarGlossaryDetailDataMock).toHaveBeenCalledWith(
      "100%",
      searchParams
    );
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
