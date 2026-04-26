import { describe, expect, it } from "vitest";

import {
  createInitialKatakanaSpeedState,
  generateKatakanaSpeedOptions,
  generateKatakanaSpeedSessionPlan,
  getKatakanaSpeedCatalog,
  getKatakanaSpeedConfusionClusters,
  getKatakanaSpeedItemById,
  getKatakanaSpeedItemBySurface
} from "@/features/katakana-speed/model";
import {
  KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS,
  KATAKANA_SPEED_PSEUDOWORD_CHUNKS,
  KATAKANA_SPEED_PSEUDOWORD_SEED_FRAMES
} from "@/features/katakana-speed/model/pseudoword-catalog";

const legacyPseudowordIds = [
  ["pseudo-ti-rado", "ティラード"],
  ["pseudo-di-rado", "ディラード"],
  ["pseudo-dyu-kan", "デュカン"],
  ["pseudo-fa-moru", "ファモル"],
  ["pseudo-fi-rado", "フィラード"],
  ["pseudo-we-ran", "ウェラン"],
  ["pseudo-kwo-rikku", "クォリック"],
  ["pseudo-vyo-ran", "ヴョラン"]
] as const;

describe("katakana speed full pseudoword catalog", () => {
  it("materializes the operational 45 chunk x 6 frame seed bank", () => {
    const seedItems = getKatakanaSpeedCatalog().filter(
      (item) => item.kind === "pseudoword" && item.tags.includes("pseudo-seed")
    );

    expect(KATAKANA_SPEED_PSEUDOWORD_CHUNKS).toHaveLength(45);
    expect(KATAKANA_SPEED_PSEUDOWORD_SEED_FRAMES).toHaveLength(6);
    expect(seedItems).toHaveLength(270);
    expect(seedItems.every((item) => item.isPseudo)).toBe(true);
    expect(seedItems.every((item) => item.focusChunks.length > 0)).toBe(true);
  });

  it("keeps catalog IDs and surfaces unique after deduping pseudoword metadata", () => {
    const catalog = getKatakanaSpeedCatalog();
    const ids = new Set(catalog.map((item) => item.id));
    const surfaces = new Set(catalog.map((item) => item.surface));

    expect(ids.size).toBe(catalog.length);
    expect(surfaces.size).toBe(catalog.length);
  });

  it("preserves legacy pseudoword IDs and makes イェ a real chunk target", () => {
    for (const [itemId, surface] of legacyPseudowordIds) {
      expect(getKatakanaSpeedItemById(itemId)).toMatchObject({
        kind: "pseudoword",
        surface
      });
    }

    expect(getKatakanaSpeedItemById("chunk-ye")).toMatchObject({
      focusChunks: ["イェ"],
      kind: "extended_chunk",
      surface: "イェ"
    });
    expect(getKatakanaSpeedItemBySurface("イェトール")).toMatchObject({
      focusChunks: ["イェ"],
      kind: "pseudoword",
      tier: "B"
    });
  });

  it("keeps all minimal pseudo-pairs first-class and directionally resolvable", () => {
    expect(KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS).toHaveLength(26);

    for (const pair of KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS) {
      const target = getKatakanaSpeedItemBySurface(pair.targetSurface);
      const distractor = getKatakanaSpeedItemBySurface(pair.distractorSurface);

      expect(target, pair.targetSurface).toMatchObject({
        kind: "pseudoword"
      });
      expect(distractor, pair.distractorSurface).toMatchObject({
        kind: "pseudoword"
      });
      if (!target || !distractor) {
        throw new Error(
          `Missing minimal pseudo-pair item for ${pair.targetSurface}/${pair.distractorSurface}`
        );
      }
      expect(target?.focusChunks).toContain(pair.targetChunk);
      expect(distractor?.focusChunks).toContain(pair.distractorChunk);
      expect(target?.distractorItemIds).toContain(distractor?.id);
      expect(distractor?.distractorItemIds).toContain(target?.id);
      expect(
        getKatakanaSpeedConfusionClusters().some(
          (cluster) =>
            cluster.itemIds.includes(target.id) &&
            cluster.itemIds.includes(distractor.id)
        )
      ).toBe(true);
    }
  });

  it("derives pseudoword display segments and mora counts from the tokenizer", () => {
    expect(getKatakanaSpeedItemBySurface("アティール")).toMatchObject({
      displaySegments: ["ア", "ティー", "ル"],
      moraCount: 4
    });
    expect(getKatakanaSpeedItemBySurface("コフィット")).toMatchObject({
      displaySegments: ["コ", "フィッ", "ト"],
      moraCount: 4
    });
    expect(getKatakanaSpeedItemBySurface("ヴュラン")).toMatchObject({
      displaySegments: ["ヴュ", "ラ", "ン"],
      moraCount: 3
    });
  });

  it("keeps distractor-only pair ends out of pseudoword transfer target pools", () => {
    const plan = generateKatakanaSpeedSessionPlan({
      count: 30,
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "pseudo-targetable",
      sessionMode: "pseudoword_transfer",
      state: createInitialKatakanaSpeedState({
        now: new Date("2026-04-26T08:00:00.000Z")
      })
    });

    const pseudoSprintItems = plan
      .filter((trial) => trial.mode === "pseudoword_sprint")
      .map((trial) => getKatakanaSpeedItemById(trial.itemId));

    expect(pseudoSprintItems.length).toBeGreaterThan(0);
    expect(
      pseudoSprintItems.every(
        (item) => item && !item.tags.includes("targetable-false")
      )
    ).toBe(true);
  });

  it("keeps targetable rare/C-tier pseudowords reachable in explicit transfer", () => {
    const rarePseudoword = getKatakanaSpeedItemById("pseudo-vyo-ran");
    const initialState = createInitialKatakanaSpeedState({
      now: new Date("2026-04-26T08:00:00.000Z")
    });

    expect(rarePseudoword).toMatchObject({
      kind: "pseudoword",
      rarity: "rare",
      tier: "C"
    });
    if (!rarePseudoword) {
      throw new Error("Missing legacy C-tier pseudoword pseudo-vyo-ran");
    }

    const state = {
      ...initialState,
      items: {
        ...initialState.items,
        [rarePseudoword.id]: {
          ...initialState.items[rarePseudoword.id],
          lapses: 4,
          lastErrorTags: ["phonological_confusion"] as const,
          reps: 1,
          status: "learning" as const
        }
      }
    };
    const plan = generateKatakanaSpeedSessionPlan({
      count: 1,
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "rare-pseudo-targetable",
      sessionMode: "pseudoword_transfer",
      state
    });

    expect(plan[0]).toMatchObject({
      itemId: rarePseudoword.id,
      mode: "pseudoword_sprint"
    });
  });

  it("prefers direct minimal-pair distractors when building choice options", () => {
    const target = getKatakanaSpeedItemBySurface("ティラード");
    const distractor = getKatakanaSpeedItemBySurface("チラード");

    expect(target).toBeDefined();
    expect(distractor).toBeDefined();

    const options = generateKatakanaSpeedOptions({
      count: 4,
      seed: "minimal-pair-options",
      targetItemId: target?.id ?? ""
    });

    expect(options).toContain(target?.id);
    expect(options).toContain(distractor?.id);
  });
});
