import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KanjiClashPage } from "@/components/kanji-clash/kanji-clash-page";
import type {
  KanjiClashEligibleSubject,
  KanjiClashPageData,
  KanjiClashSessionRound
} from "@/lib/kanji-clash";

describe("kanji clash page", () => {
  it("renders the workspace shell with mode toggles, media filters, and round layout", () => {
    const markup = renderToStaticMarkup(
      createElement(KanjiClashPage, {
        data: buildPageData({
          currentRound: buildRound({
            left: buildSubject({
              label: "食費",
              meaningIt: "spese per il cibo",
              reading: "しょくひ",
              subjectKey: "entry:term:term-alpha-shokuhi"
            }),
            right: buildSubject({
              label: "食品",
              meaningIt: "alimento",
              reading: "しょくひん",
              subjectKey: "entry:term:term-alpha-shokuhin"
            }),
            targetPlacement: "left"
          }),
          mode: "manual",
          queue: {
            currentRoundIndex: 0,
            requestedSize: 20
          },
          selectedMedia: {
            id: "media-alpha",
            slug: "alpha",
            title: "Alpha"
          }
        })
      })
    );

    expect(markup).toContain("Workspace di confronto");
    expect(markup).toContain("Automatico");
    expect(markup).toContain("Drill manuale");
    expect(markup).toContain("Target");
    expect(markup).toContain("Opzione sinistra");
    expect(markup).toContain("Opzione destra");
    expect(markup).toContain("食費");
    expect(markup).toContain("食品");
    expect(markup).toContain("spese per il cibo");
    expect(markup).not.toContain("alimento");
    expect(markup).not.toContain("しょくひん");
    expect(markup).toContain(
      'href="/kanji-clash?mode=automatic&amp;media=alpha"'
    );
    expect(markup).toContain(
      'href="/kanji-clash?mode=manual&amp;media=alpha&amp;size=20"'
    );
    expect(markup).toContain('href="/kanji-clash?mode=manual&amp;size=20"');
    expect(markup).toContain(
      'href="/kanji-clash?mode=manual&amp;media=alpha&amp;size=10"'
    );
    expect(markup).toContain(
      'href="/kanji-clash?mode=manual&amp;media=alpha&amp;size=40"'
    );
  });

  it("renders a clean empty state when no round is available", () => {
    const markup = renderToStaticMarkup(
      createElement(KanjiClashPage, {
        data: buildPageData({
          currentRound: null,
          queue: {
            currentRoundIndex: 0,
            finished: true,
            totalCount: 0
          }
        })
      })
    );

    expect(markup).toContain("Sessione completata");
    expect(markup).toContain("Apri drill manuale");
  });
});

function buildPageData(
  overrides: {
    availableMedia?: KanjiClashPageData["availableMedia"];
    currentRound?: KanjiClashPageData["currentRound"];
    mode?: KanjiClashPageData["mode"];
    queue?: Partial<KanjiClashPageData["queue"]>;
    selectedMedia?: KanjiClashPageData["selectedMedia"];
    settings?: Partial<KanjiClashPageData["settings"]>;
  } = {}
): KanjiClashPageData {
  const selectedMedia = overrides.selectedMedia ?? null;
  const mode = overrides.mode ?? "automatic";
  const scope = selectedMedia ? "media" : "global";
  const currentRound = Object.prototype.hasOwnProperty.call(
    overrides,
    "currentRound"
  )
    ? overrides.currentRound
    : buildRound({});
  const rounds = currentRound ? [currentRound] : [];
  const queue = {
    awaitingConfirmation: false,
    currentRoundIndex: 0,
    dailyNewLimit: 5,
    dueCount: 1,
    finished: false,
    introducedTodayCount: 1,
    mode,
    newAvailableCount: 2,
    newQueuedCount: 1,
    remainingCount: 3,
    requestedSize: null,
    reserveCount: 0,
    rounds,
    snapshotAtIso: "2026-04-09T12:00:00.000Z",
    scope,
    seenPairKeys: [],
    totalCount: 1,
    ...(overrides.queue ?? {})
  } satisfies KanjiClashPageData["queue"];
  const settings = {
    dailyNewLimit: 5,
    defaultScope: "global",
    manualDefaultSize: 20,
    manualSizeOptions: [10, 20, 40],
    ...(overrides.settings ?? {})
  } satisfies KanjiClashPageData["settings"];

  return {
    availableMedia: overrides.availableMedia ?? [
      { id: "media-alpha", slug: "alpha", title: "Alpha" },
      { id: "media-beta", slug: "beta", title: "Beta" }
    ],
    currentRound: currentRound as KanjiClashPageData["currentRound"],
    mode,
    queue,
    scope,
    selectedMedia,
    settings,
    snapshotAtIso: "2026-04-09T12:00:00.000Z"
  };
}

function buildRound(
  overrides: Partial<KanjiClashSessionRound> & {
    left?: KanjiClashEligibleSubject;
    right?: KanjiClashEligibleSubject;
    targetPlacement?: "left" | "right";
  }
): KanjiClashSessionRound {
  const left =
    overrides.left ??
    buildSubject({
      label: "食費",
      meaningIt: "spese per il cibo",
      reading: "しょくひ",
      subjectKey: "entry:term:term-alpha-shokuhi"
    });
  const right =
    overrides.right ??
    buildSubject({
      label: "食品",
      meaningIt: "alimento",
      reading: "しょくひん",
      subjectKey: "entry:term:term-alpha-shokuhin"
    });
  const targetPlacement = overrides.targetPlacement ?? "left";
  const target = targetPlacement === "left" ? left : right;

  return {
    candidate: {
      left,
      leftSubjectKey: left.subjectKey,
      pairKey: "pair-alpha",
      right,
      rightSubjectKey: right.subjectKey,
      score: 120,
      sharedKanji: ["食"]
    },
    correctSubjectKey: target.subjectKey,
    left,
    leftSubjectKey: left.subjectKey,
    pairKey: "pair-alpha",
    pairState: null,
    right,
    rightSubjectKey: right.subjectKey,
    source: "due",
    target,
    targetPlacement,
    targetSubjectKey: target.subjectKey,
    ...overrides
  };
}

function buildSubject(
  overrides: Partial<KanjiClashEligibleSubject> & {
    label?: string;
    meaningIt?: string;
    reading?: string;
    subjectKey?: string;
  }
): KanjiClashEligibleSubject {
  const label = overrides.label ?? "食費";
  const meaningIt = overrides.meaningIt ?? "spese per il cibo";
  const reading = overrides.reading ?? "しょくひ";
  const subjectKey = overrides.subjectKey ?? "entry:term:term-alpha-shokuhi";

  return {
    entryType: "term",
    kanji: ["食", "費"],
    label,
    members: [
      {
        entryId: subjectKey.replace("entry:term:", ""),
        lemma: label,
        meaningIt,
        mediaId: "media-alpha",
        mediaSlug: "alpha",
        mediaTitle: "Alpha",
        reading
      }
    ],
    reading,
    readingForms: [reading],
    reps: 3,
    reviewState: "review",
    source: {
      entryId: subjectKey.replace("entry:term:", ""),
      type: "entry"
    },
    stability: 8.5,
    subjectKey,
    surfaceForms: [label],
    ...overrides
  };
}
