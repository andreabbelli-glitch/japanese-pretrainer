import { describe, expect, it } from "vitest";

import {
  addForvoWordAddRequestEntry,
  buildForvoWordAddPrefill,
  buildForvoWordAddUrl,
  hasForvoWordAddRequestForEntry,
  normalizeForvoWordAddLabel,
  type ForvoWordAddRequestRegistry
} from "@/lib/pronunciation";

describe("forvo word-add helpers", () => {
  it("builds the expected word-add URL for a label", () => {
    expect(
      buildForvoWordAddUrl({
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        reading: "こうげきさき"
      })
    ).toBe(
      "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0"
    );
  });

  it("normalizes slash-separated labels for Forvo word-add URLs", () => {
    expect(normalizeForvoWordAddLabel("持ちきれない / 持ちきれません")).toBe(
      "持ちきれない・持ちきれません"
    );

    expect(
      buildForvoWordAddUrl({
        entryId: "term-e003-mochikirenai-mochikiremasen",
        entryKind: "term",
        label: "持ちきれない / 持ちきれません",
        reading: "もちきれない / もちきれません"
      })
    ).toBe(
      "https://forvo.com/word-add/%E6%8C%81%E3%81%A1%E3%81%8D%E3%82%8C%E3%81%AA%E3%81%84%E3%83%BB%E6%8C%81%E3%81%A1%E3%81%8D%E3%82%8C%E3%81%BE%E3%81%9B%E3%82%93/?jcs_lang=ja&jcs_phrase=1&jcs_autosubmit=1&jcs_person_name=0"
    );
  });

  it("marks phrase-like entries with a phrase prefill", () => {
    expect(
      buildForvoWordAddPrefill({
        entryId: "grammar-g034-perche",
        entryKind: "grammar",
        label: "から"
      })
    ).toMatchObject({
      autoSubmit: true,
      isPhrase: true,
      isPersonalName: false,
      languageCode: "ja"
    });

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-e025-dekiruyouninatta",
        entryKind: "term",
        label: "〜できるようになった",
        reading: "〜できるようになった"
      }).isPhrase
    ).toBe(true);

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-e101-shitei-no-kyoushitsu-e-mukatte-kudasai",
        entryKind: "term",
        label: "指定の教室へ 向かってください",
        reading: "していの きょうしつへ むかってください"
      }).isPhrase
    ).toBe(true);

    expect(
      buildForvoWordAddPrefill({
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        reading: "こうげきさき"
      }).isPhrase
    ).toBe(false);
  });

  it("deduplicates requested word-add entries by media, kind, and id", () => {
    const registry: ForvoWordAddRequestRegistry = {
      entries: [],
      version: 1
    };

    expect(
      addForvoWordAddRequestEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        mediaSlug: "duel-masters-dm25",
        reading: "こうげきさき"
      })
    ).toBe(true);
    expect(
      addForvoWordAddRequestEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        label: "攻撃先",
        mediaSlug: "duel-masters-dm25",
        reading: "こうげきさき"
      })
    ).toBe(false);

    expect(registry.entries).toHaveLength(1);
    expect(
      hasForvoWordAddRequestForEntry(registry, {
        entryId: "term-kougekisaki",
        entryKind: "term",
        mediaSlug: "duel-masters-dm25"
      })
    ).toBe(true);
    expect(registry.entries[0]?.requestUrl).toBe(
      "https://forvo.com/word-add/%E6%94%BB%E6%92%83%E5%85%88/?jcs_lang=ja&jcs_phrase=0&jcs_autosubmit=1&jcs_person_name=0"
    );
  });
});
