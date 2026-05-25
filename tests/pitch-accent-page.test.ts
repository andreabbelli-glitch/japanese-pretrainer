import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PitchAccentPage } from "@/components/pitch-accent/pitch-accent-page";
import { PitchAccentSessionPage } from "@/components/pitch-accent/pitch-accent-session-page";
import type {
  PitchAccentPageData,
  PitchAccentSessionPageData
} from "@/features/pitch-accent/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push() {}
  })
}));

const pageData: PitchAccentPageData = {
  corpusPairCount: 1882,
  recentSession: null
};

const sessionData: PitchAccentSessionPageData = {
  answeredCount: 0,
  filters: {
    onlyDevoiced: false,
    patternKeys: ["pitch0", "pitch1"],
    strictPairFinding: false
  },
  sessionId: "pitch-accent-session-fixture",
  startedAt: "2026-05-25T08:00:00.000Z",
  status: "active",
  trials: [
    {
      correctOptionId: "pair-a:1",
      correctPatternKey: "pitch1",
      kana: "はし",
      options: [
        {
          accentedMora: 0,
          audioMime: "audio/aac",
          audioSrc: "/vendor/minimal-pairs/audio/pair-a/0.aac",
          id: "pair-a:0",
          moraCount: 2,
          pitchAccent: 0,
          rawPronunciation: "ハシ",
          silencedMoras: []
        },
        {
          accentedMora: 1,
          audioMime: "audio/aac",
          audioSrc: "/vendor/minimal-pairs/audio/pair-a/1.aac",
          id: "pair-a:1",
          moraCount: 2,
          pitchAccent: 1,
          rawPronunciation: "ハシ",
          silencedMoras: []
        }
      ],
      pairId: "pair-a",
      sessionId: "pitch-accent-session-fixture",
      sortOrder: 0,
      trialId: "pitch-accent-session-fixture:trial-1"
    }
  ]
};

describe("pitch accent pages", () => {
  it("renders the landing page with corpus size and start controls", () => {
    const markup = renderToStaticMarkup(
      createElement(PitchAccentPage, { data: pageData })
    );

    expect(markup).toContain("Pitch Accent");
    expect(markup).toContain("1.882");
    expect(markup).toContain("Avvia sessione");
    expect(markup).toContain("Corpus statici");
    expect(markup).toContain("licenze nei NOTICE locali");
  });

  it("renders the session workspace with audio and accent choices", () => {
    const markup = renderToStaticMarkup(
      createElement(PitchAccentSessionPage, { data: sessionData })
    );

    expect(markup).toContain("1 / 1");
    expect(markup).toContain("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(markup).toContain("pitch-accent__graph");
    expect(markup).toContain('data-testid="pitch-accent-option"');
  });
});
