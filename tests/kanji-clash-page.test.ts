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

  it("renders compact similar-kanji copy for a similar-only round", () => {
    const markup = renderToStaticMarkup(
      createElement(KanjiClashPage, {
        data: buildKanjiClashPageData({
          currentRound: buildKanjiClashRound({
            candidate: {
              left: buildKanjiClashSubject({
                kanji: ["待"],
                label: "待つ",
                meaningIt: "aspettare",
                reading: "まつ",
                subjectKey: "entry:term:wait"
              }),
              leftSubjectKey: "entry:term:wait",
              pairKey: "entry:term:hold::entry:term:wait",
              pairReasons: ["similar-kanji"],
              right: buildKanjiClashSubject({
                kanji: ["持"],
                label: "持つ",
                meaningIt: "tenere in mano",
                reading: "もつ",
                subjectKey: "entry:term:hold"
              }),
              rightSubjectKey: "entry:term:hold",
              score: 118,
              sharedKanji: [],
              similarKanjiSwaps: [
                {
                  confidence: 1,
                  leftKanji: "待",
                  position: 0,
                  rightKanji: "持"
                }
              ]
            },
            left: buildKanjiClashSubject({
              kanji: ["待"],
              label: "待つ",
              meaningIt: "aspettare",
              reading: "まつ",
              subjectKey: "entry:term:wait"
            }),
            pairKey: "entry:term:hold::entry:term:wait",
            right: buildKanjiClashSubject({
              kanji: ["持"],
              label: "持つ",
              meaningIt: "tenere in mano",
              reading: "もつ",
              subjectKey: "entry:term:hold"
            }),
            targetPlacement: "left"
          })
        })
      })
    );

    expect(markup).toContain("Kanji simili: 待 / 持");
  });

  it("renders both shared and similar indicators when a round carries both reasons", () => {
    const markup = renderToStaticMarkup(
      createElement(KanjiClashPage, {
        data: buildKanjiClashPageData({
          currentRound: buildKanjiClashRound({
            candidate: {
              left: buildKanjiClashSubject({
                kanji: ["待", "機"],
                label: "待機",
                meaningIt: "attesa",
                reading: "たいき",
                subjectKey: "entry:term:left"
              }),
              leftSubjectKey: "entry:term:left",
              pairKey: "entry:term:left::entry:term:right",
              pairReasons: ["shared-kanji", "similar-kanji"],
              right: buildKanjiClashSubject({
                kanji: ["持", "機"],
                label: "持機",
                meaningIt: "fixture",
                reading: "じき",
                subjectKey: "entry:term:right"
              }),
              rightSubjectKey: "entry:term:right",
              score: 128,
              sharedKanji: ["機"],
              similarKanjiSwaps: [
                {
                  confidence: 1,
                  leftKanji: "待",
                  position: 0,
                  rightKanji: "持"
                }
              ]
            },
            left: buildKanjiClashSubject({
              kanji: ["待", "機"],
              label: "待機",
              meaningIt: "attesa",
              reading: "たいき",
              subjectKey: "entry:term:left"
            }),
            pairKey: "entry:term:left::entry:term:right",
            right: buildKanjiClashSubject({
              kanji: ["持", "機"],
              label: "持機",
              meaningIt: "fixture",
              reading: "じき",
              subjectKey: "entry:term:right"
            }),
            targetPlacement: "left"
          })
        })
      })
    );

    expect(markup).toContain("機");
    expect(markup).toContain("Kanji simili: 待 / 持");
  });
});
