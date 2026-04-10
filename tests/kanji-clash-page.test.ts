import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KanjiClashPage } from "@/components/kanji-clash/kanji-clash-page";

import {
  buildKanjiClashPageData,
  buildKanjiClashRound,
  buildKanjiClashSubject
} from "./helpers/kanji-clash-test-data";

describe("kanji clash page", () => {
  it("renders the workspace shell with mode toggles, media filters, and round layout", () => {
    const markup = renderToStaticMarkup(
      createElement(KanjiClashPage, {
        data: buildKanjiClashPageData({
          currentRound: buildKanjiClashRound({
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
    expect(markup).toContain("FSRS");
    expect(markup).toContain("Drill");
    expect(markup).toContain("Target");
    expect(markup).toContain("食費");
    expect(markup).toContain("食品");
    expect(markup).toContain("spese per il cibo");
    expect(markup).not.toContain("alimento");
    expect(markup).not.toContain("しょくひん");
    expect(markup).not.toContain(
      "Scegli quale forma giapponese corrisponde al target."
    );
    expect(markup).not.toContain(
      "Forma giapponese da confrontare visivamente con il target centrale."
    );
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
        data: buildKanjiClashPageData({
          mode: "manual",
          currentRound: null,
          queue: {
            currentRoundIndex: 0,
            finished: true,
            requestedSize: 20,
            totalCount: 2
          }
        })
      })
    );

    expect(markup).toContain("Sessione completata");
    expect(markup).toContain("Aggiungi altri 10 round");
    expect(markup).toContain('href="/kanji-clash?mode=manual&amp;size=30"');
    expect(markup).toContain("Apri FSRS");
  });
});
