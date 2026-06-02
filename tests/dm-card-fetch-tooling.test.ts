import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildDmCardFetchResult,
  formatDmCardFetchResult,
  isOfficialCardDetailUrl,
  parseOfficialTcgCardDetail
} from "@/features/content/tooling/dm-card-fetch";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/dm-card-fetch");
const dedodamFixture = readFixture("official-detail-dm25rp4-T07.html");
const triggerFixture = readFixture("official-detail-dmr19-067.html");

describe("dm card fetch tooling", () => {
  it("parses compact official card detail fields and text lines", () => {
    const card = parseOfficialTcgCardDetail({
      html: dedodamFixture,
      sourceUrl: "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
    });

    expect(card).toEqual(
      expect.objectContaining({
        abilities: [
          "このクリーチャーが出た時、自分の山札の上から３枚を見る。その中から１枚を手札に加え、１枚をマナゾーンに置き、残りの１枚を墓地に置く。"
        ],
        civilization: "水/闇/自然",
        cost: "3",
        flavor: "その愛は、天才に注がれる。",
        imageUrl:
          "https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm25rp4-T07.jpg",
        name: "天災 デドダム",
        officialId: "dm25rp4-T07",
        power: "3000",
        print: "DM25RP4 T7/T10",
        race: "トリニティ・コマンド/侵略者",
        rarity: "R",
        type: "クリーチャー"
      })
    );
  });

  it("preserves official keyword text when icons are rendered as images", () => {
    const card = parseOfficialTcgCardDetail({
      html: triggerFixture,
      sourceUrl: "https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067"
    });

    expect(card?.abilities).toEqual([
      "S・トリガー（このクリーチャーをシールドゾーンから手札に加える時、コストを支払わずにすぐ召喚してもよい）",
      "ブロッカー（このクリーチャーをタップして、相手クリーチャーの攻撃先をこのクリーチャーに変更してもよい）",
      "このクリーチャーは攻撃できない。"
    ]);
  });

  it("formats fetched data as a compact helper record with verification flags", () => {
    const result = buildDmCardFetchResult({
      expectations: {
        keywords: [],
        name: undefined,
        print: undefined,
        textLines: [],
        type: undefined
      },
      html: dedodamFixture,
      inputKind: "fixture-html",
      sourceUrl: "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
    });

    expect(result.status).toBe("found");

    const output = formatDmCardFetchResult(result);

    expect(output).toContain(
      "STATUS found source=official-tcg confidence=medium checks=unchecked authority=helper"
    );
    expect(output).toContain(
      'CARD official=dm25rp4-T07 name="天災 デドダム" print="DM25RP4 T7/T10"'
    );
    expect(output).toContain("TEXT lines=1 hash=sha256:");
    expect(output).toContain(
      'T1 "このクリーチャーが出た時、自分の山札の上から３枚を見る。'
    );
    expect(output).toContain(
      "FLAGS verify_with_screenshot errata_possible duel_plays_not_checked ground_truth_user_input"
    );
  });

  it("marks mismatches instead of promoting fetched text to ground truth", () => {
    const result = buildDmCardFetchResult({
      expectations: {
        keywords: ["G・ゼロ"],
        name: "貝獣 ラリア",
        print: undefined,
        textLines: ["次の条件を満たしていれば、"],
        type: undefined
      },
      html: dedodamFixture,
      inputKind: "fixture-html",
      sourceUrl: "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
    });

    expect(result.status).toBe("mismatch");
    expect(result.confidence).toBe("blocked");
    expect(result.checks.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expected: "貝獣 ラリア",
          field: "name",
          status: "fail"
        }),
        expect.objectContaining({
          expected: "G・ゼロ",
          field: "keyword",
          status: "fail"
        }),
        expect.objectContaining({
          expected: "次の条件を満たしていれば、",
          field: "text-line",
          status: "fail"
        })
      ])
    );
    expect(formatDmCardFetchResult(result)).toContain(
      "ACTION prefer user-provided screenshot/text; inspect mismatch before using fetched text"
    );
  });

  it("accepts only HTTPS official detail URLs with a safe card id", () => {
    expect(
      isOfficialCardDetailUrl(
        "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
      )
    ).toBe(true);
    expect(
      isOfficialCardDetailUrl(
        "http://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07"
      )
    ).toBe(false);
    expect(
      isOfficialCardDetailUrl(
        "https://dm.takaratomy.co.jp/card/detail/?id=../dm25rp4-T07"
      )
    ).toBe(false);
    expect(
      isOfficialCardDetailUrl(
        "https://dm.takaratomy.co.jp/card/detail/?id=dm25rp4-T07&id=../bad"
      )
    ).toBe(false);
    expect(
      isOfficialCardDetailUrl(
        "https://dm.takaratomy.co.jp/card/detail/extra/?id=dm25rp4-T07"
      )
    ).toBe(false);
  });
});

function readFixture(name: string) {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}
