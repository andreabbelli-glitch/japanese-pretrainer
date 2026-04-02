import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import MediaGlossaryRoute from "@/app/media/[mediaSlug]/glossary/page";

describe("media glossary route", () => {
  it("preserves the local segment filter when redirecting to the global glossary", async () => {
    await expect(
      MediaGlossaryRoute({
        params: Promise.resolve({
          mediaSlug: "fixture-tcg"
        }),
        searchParams: Promise.resolve({
          q: "iku",
          returnTo: "/review?answered=3&card=card-iku",
          segment: "segment_fixture_starter_core",
          study: "learning"
        })
      })
    ).rejects.toThrow(
      "redirect:/glossary?q=iku&media=fixture-tcg&segment=segment_fixture_starter_core&study=learning&returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"
    );

    expect(redirectMock).toHaveBeenCalledWith(
      "/glossary?q=iku&media=fixture-tcg&segment=segment_fixture_starter_core&study=learning&returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"
    );
  });
});
