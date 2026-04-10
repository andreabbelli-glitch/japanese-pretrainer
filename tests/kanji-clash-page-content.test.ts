import { describe, expect, it } from "vitest";

import { buildKanjiClashPageContent } from "@/components/kanji-clash/kanji-clash-page-content";

import {
  buildKanjiClashPageData,
  buildKanjiClashQueue,
  buildKanjiClashRound,
  buildKanjiClashSubject
} from "./helpers/kanji-clash-test-data";

describe("kanji clash page content", () => {
  it("builds the page copy and hrefs for the active round view", () => {
    const round = buildKanjiClashRound({
      left: buildKanjiClashSubject({
        kanji: ["食", "費"],
        label: "食費",
        meaningIt: "spese per il cibo",
        reading: "しょくひ",
        subjectKey: "entry:term:term-alpha-shokuhi"
      }),
      right: buildKanjiClashSubject({
        kanji: ["食", "品"],
        label: "食品",
        meaningIt: "alimento",
        reading: "しょくひん",
        subjectKey: "entry:term:term-alpha-shokuhin"
      }),
      targetPlacement: "left"
    });
    const content = buildKanjiClashPageContent({
      currentRound: round,
      data: buildKanjiClashPageData({
        currentRound: round,
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
      }),
      feedback: {
        answeredRound: round,
        correctSubjectKey: round.correctSubjectKey,
        selectedSubjectKey: round.rightSubjectKey
      },
      queue: buildKanjiClashQueue(0)
    });

    expect(content.header.summary).toContain("Scope Alpha");
    expect(content.header.modeLinks.automatic).toBe(
      "/kanji-clash?mode=automatic&media=alpha"
    );
    expect(content.header.modeLinks.manual).toBe(
      "/kanji-clash?mode=manual&media=alpha&size=20"
    );
    expect(content.round.scopeLabel).toBe("Alpha");
    expect(content.round.summary).toContain("target centrale");
    expect(content.round.feedbackCopy).toEqual({
      description:
        "Hai selezionato 食品 · しょくひん (alimento). Risposta giusta: 食費 · しょくひ (spese per il cibo).",
      title: "Risposta errata"
    });
    expect(content.sidebar.summary).toContain("Sessione finita con taglia 20");
    expect(content.sidebar.stats.scopeDetail).toBe("Alpha");
    expect(content.sidebar.mediaFilters).toEqual([
      {
        active: false,
        href: "/kanji-clash?mode=manual&size=20",
        label: "Globale"
      },
      {
        active: true,
        href: "/kanji-clash?mode=manual&media=alpha&size=20",
        label: "Alpha"
      },
      {
        active: false,
        href: "/kanji-clash?mode=manual&media=beta&size=20",
        label: "Beta"
      }
    ]);
    expect(content.sidebar.sizeFilters?.map((item) => item.href)).toEqual([
      "/kanji-clash?mode=manual&media=alpha&size=10",
      "/kanji-clash?mode=manual&media=alpha&size=20",
      "/kanji-clash?mode=manual&media=alpha&size=40"
    ]);
    expect(content.emptyState).toBeNull();
  });

  it("builds the empty state actions when no round is available", () => {
    const content = buildKanjiClashPageContent({
      currentRound: null,
      data: buildKanjiClashPageData({
        currentRound: null,
        queue: {
          finished: true,
          totalCount: 0
        }
      }),
      feedback: null,
      queue: buildKanjiClashQueue(0, {
        finished: true,
        remainingCount: 0,
        totalCount: 0
      })
    });

    expect(content.header.summary).toBe(
      "La coda corrente è completa. Cambia filtro o modalità per aprire il prossimo workspace."
    );
    expect(content.emptyState).toEqual({
      description:
        "Hai chiuso la coda corrente. Puoi cambiare modalità, allargare lo scope o aprire un drill manuale su una frontiera diversa.",
      primaryAction: {
        href: "/kanji-clash?mode=manual&size=20",
        label: "Apri Drill"
      },
      secondaryAction: null,
      title: "Sessione completata"
    });
    expect(content.sidebar.note).toBe(
      "Le nuove coppie restano separate dalla review standard e contano solo nel workspace Kanji Clash."
    );
  });
});
