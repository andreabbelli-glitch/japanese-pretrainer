import type { Route } from "next";
import { describe, expect, it } from "vitest";

import { resolveGlossaryReviewReturnTo } from "@/lib/site";

describe("return-to helpers", () => {
  it("returns null instead of looping on self-referential glossary returnTo chains", () => {
    const cyclicHref =
      "/glossary?q=iku&returnTo=%2Fglossary%3Fq%3Diku%26returnTo%3D%252Fglossary%253Fq%253Diku%2526returnTo%253D%25252Fglossary%25253Fq%25253Diku" as Route;

    expect(resolveGlossaryReviewReturnTo(cyclicHref)).toBeNull();
  });

  it("returns null instead of looping on multi-step glossary returnTo cycles", () => {
    const firstHref =
      "/glossary?q=iku&returnTo=%2Fmedia%2Ffixture-tcg%2Fglossary%3Fq%3Diku" as Route;
    const secondHref =
      "/media/fixture-tcg/glossary?q=iku&returnTo=%2Fglossary%3Fq%3Diku%26returnTo%3D%252Fmedia%252Ffixture-tcg%252Fglossary%253Fq%253Diku" as Route;

    expect(resolveGlossaryReviewReturnTo(firstHref)).toBeNull();
    expect(resolveGlossaryReviewReturnTo(secondHref)).toBeNull();
  });
});
