import type {
  KatakanaSpeedItem,
  KatakanaSpeedRarity,
  KatakanaSpeedTier
} from "../types.ts";

export type KatakanaSpeedPseudowordCatalogDefinition = {
  readonly family: string;
  readonly focusChunks: readonly string[];
  readonly id: string;
  readonly rarity: KatakanaSpeedRarity;
  readonly surface: string;
  readonly tags: readonly string[];
  readonly targetable: boolean;
  readonly tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">;
};

export type KatakanaSpeedPseudowordConfusionClusterDefinition = {
  readonly id: string;
  readonly itemIds: readonly string[];
};

type MutablePseudowordDefinition = {
  family: string;
  focusChunks: Set<string>;
  id: string;
  rarity: KatakanaSpeedRarity;
  surface: string;
  tags: Set<string>;
  targetable: boolean;
  tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">;
};

type PseudowordDefinitionInput = Omit<
  KatakanaSpeedPseudowordCatalogDefinition,
  "tags"
> & {
  readonly tags: readonly string[];
};

export const KATAKANA_SPEED_PSEUDOWORD_CHUNKS = [
  "シェ",
  "ジェ",
  "チェ",
  "ツァ",
  "ツェ",
  "ツォ",
  "ティ",
  "ディ",
  "ファ",
  "フィ",
  "フェ",
  "フォ",
  "デュ",
  "イェ",
  "ウィ",
  "ウェ",
  "ウォ",
  "クァ",
  "クィ",
  "クェ",
  "クォ",
  "グァ",
  "ツィ",
  "トゥ",
  "ドゥ",
  "ヴァ",
  "ヴィ",
  "ヴェ",
  "ヴォ",
  "テュ",
  "フュ",
  "ヴュ",
  "スィ",
  "ズィ",
  "グィ",
  "グェ",
  "グォ",
  "キェ",
  "ギェ",
  "ニェ",
  "ヒェ",
  "ビェ",
  "ピェ",
  "フョ",
  "ヴョ"
] as const;

export const KATAKANA_SPEED_PSEUDOWORD_SEED_FRAMES = [
  { after: "トール", before: "", id: "initial-toru" },
  { after: "リック", before: "", id: "initial-rikku" },
  { after: "ール", before: "ア", id: "a-long" },
  { after: "ラン", before: "メ", id: "me-ran" },
  { after: "ット", before: "コ", id: "ko-tto" },
  { after: "ス", before: "ラ", id: "ra-su" }
] as const;

export const KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS = [
  pair("ti-chi", "ティ", "チ", "ティラード", "チラード"),
  pair("ti-tei", "ティ", "テイ", "ティモス", "テイモス"),
  pair("di-ji", "ディ", "ジ", "ディラード", "ジラード"),
  pair("di-dei", "ディ", "デイ", "ディモス", "デイモス"),
  pair("dyu-ju", "デュ", "ジュ", "デュカン", "ジュカン"),
  pair("dyu-du", "デュ", "ドゥ", "デュラン", "ドゥラン"),
  pair("fa-ha", "ファ", "ハ", "ファモル", "ハモル"),
  pair("fi-hi", "フィ", "ヒ", "フィラード", "ヒラード"),
  pair("fe-he", "フェ", "ヘ", "フェラス", "ヘラス"),
  pair("fo-ho", "フォ", "ホ", "フォラン", "ホラン"),
  pair("wi-i", "ウィ", "イ", "ウィラード", "イラード"),
  pair("we-e", "ウェ", "エ", "ウェラン", "エラン"),
  pair("wo-o", "ウォ", "オ", "ウォラス", "オラス"),
  pair("tu-tsu", "トゥ", "ツ", "トゥモス", "ツモス"),
  pair("du-zu", "ドゥ", "ズ", "ドゥモス", "ズモス"),
  pair("va-ba", "ヴァ", "バ", "ヴァラン", "バラン"),
  pair("vi-bi", "ヴィ", "ビ", "ヴィラス", "ビラス"),
  pair("ve-be", "ヴェ", "ベ", "ヴェロス", "ベロス"),
  pair("vo-bo", "ヴォ", "ボ", "ヴォラン", "ボラン"),
  pair("tsa-sa", "ツァ", "サ", "ツァリック", "サリック"),
  pair("tse-se", "ツェ", "セ", "ツェラン", "セラン"),
  pair("tso-so", "ツォ", "ソ", "ツォラス", "ソラス"),
  pair("kwo-ko", "クォ", "コ", "クォリック", "コリック"),
  pair("fyu-hyu", "フュ", "ヒュ", "フュラン", "ヒュラン"),
  pair("tyu-chu", "テュ", "チュ", "テュラス", "チュラス"),
  pair("vyu-byu", "ヴュ", "ビュ", "ヴュラン", "ビュラン")
] as const;

const LEGACY_PSEUDOWORD_IDS_BY_SURFACE = {
  クォリック: "pseudo-kwo-rikku",
  ディラード: "pseudo-di-rado",
  デュカン: "pseudo-dyu-kan",
  ティラード: "pseudo-ti-rado",
  ファモル: "pseudo-fa-moru",
  フィラード: "pseudo-fi-rado",
  ヴョラン: "pseudo-vyo-ran",
  ウェラン: "pseudo-we-ran"
} as const;

const LEGACY_SUPPLEMENTAL_PSEUDOWORDS = [
  {
    focusChunk: "ヴョ",
    surface: "ヴョラン"
  }
] as const;

const B_TIER_CHUNKS = new Set([
  "イェ",
  "ウィ",
  "ウェ",
  "ウォ",
  "クァ",
  "クィ",
  "クェ",
  "クォ",
  "グァ",
  "ツィ",
  "トゥ",
  "ドゥ",
  "ヴァ",
  "ヴィ",
  "ヴェ",
  "ヴォ",
  "テュ",
  "フュ",
  "ヴュ"
]);

const C_TIER_CHUNKS = new Set([
  "スィ",
  "ズィ",
  "グィ",
  "グェ",
  "グォ",
  "キェ",
  "ギェ",
  "ニェ",
  "ヒェ",
  "ビェ",
  "ピェ",
  "フョ",
  "ヴョ"
]);

const CHUNK_SLUGS: Readonly<Record<string, string>> = {
  イ: "i",
  イェ: "ye",
  ウィ: "wi",
  ウェ: "we",
  ウォ: "wo",
  エ: "e",
  オ: "o",
  クァ: "kwa",
  クィ: "kwi",
  クェ: "kwe",
  クォ: "kwo",
  グァ: "gwa",
  グィ: "gwi",
  グェ: "gwe",
  グォ: "gwo",
  コ: "ko",
  サ: "sa",
  シェ: "she",
  ジ: "ji",
  ジェ: "je",
  ジュ: "ju",
  スィ: "si",
  ズ: "zu",
  ズィ: "zi",
  セ: "se",
  ソ: "so",
  チ: "chi",
  チェ: "che",
  チュ: "chu",
  ツ: "tsu",
  ツァ: "tsa",
  ツィ: "tsi",
  ツェ: "tse",
  ツォ: "tso",
  テイ: "tei",
  ティ: "ti",
  テュ: "tyu",
  デイ: "dei",
  ディ: "di",
  デュ: "dyu",
  トゥ: "tu",
  ドゥ: "du",
  ニェ: "nye",
  ハ: "ha",
  ヒ: "hi",
  ヒェ: "hye",
  ヒュ: "hyu",
  ビ: "bi",
  ビェ: "bye",
  ビュ: "byu",
  ピェ: "pye",
  ファ: "fa",
  フィ: "fi",
  フェ: "fe",
  フォ: "fo",
  フュ: "fyu",
  フョ: "fyo",
  ヘ: "he",
  ベ: "be",
  ホ: "ho",
  ボ: "bo",
  ヴァ: "va",
  ヴィ: "vi",
  ヴェ: "ve",
  ヴォ: "vo",
  ヴュ: "vyu",
  ヴョ: "vyo",
  キェ: "kye",
  ギェ: "gye",
  バ: "ba"
};

const PSEUDOWORD_CATALOG = Object.freeze(buildPseudowordCatalog());
const PSEUDOWORD_CONFUSION_CLUSTERS = Object.freeze(
  buildPseudowordConfusionClusters()
);

export function buildKatakanaSpeedPseudowordCatalog(): readonly KatakanaSpeedPseudowordCatalogDefinition[] {
  return PSEUDOWORD_CATALOG;
}

export function buildKatakanaSpeedPseudowordConfusionClusters(): readonly KatakanaSpeedPseudowordConfusionClusterDefinition[] {
  return PSEUDOWORD_CONFUSION_CLUSTERS;
}

export function isKatakanaSpeedTargetablePseudowordItem(
  item: Pick<KatakanaSpeedItem, "kind" | "tags">
): boolean {
  return item.kind === "pseudoword" && !item.tags.includes("targetable-false");
}

function buildPseudowordCatalog() {
  const definitionsBySurface = new Map<string, MutablePseudowordDefinition>();

  for (const pairDefinition of KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS) {
    mergeDefinition(
      definitionsBySurface,
      pairItemDefinition({
        chunk: pairDefinition.targetChunk,
        pairId: pairDefinition.id,
        role: "target",
        surface: pairDefinition.targetSurface,
        targetable: true
      })
    );
    mergeDefinition(
      definitionsBySurface,
      pairItemDefinition({
        chunk: pairDefinition.distractorChunk,
        pairId: pairDefinition.id,
        role: "distractor",
        surface: pairDefinition.distractorSurface,
        targetable: false
      })
    );
  }

  for (const chunk of KATAKANA_SPEED_PSEUDOWORD_CHUNKS) {
    for (const frame of KATAKANA_SPEED_PSEUDOWORD_SEED_FRAMES) {
      const surface = `${frame.before}${chunk}${frame.after}`;
      mergeDefinition(definitionsBySurface, {
        family: "pseudo-bank",
        focusChunks: [chunk],
        id: idForSurface(
          surface,
          `pseudo-seed-${slugForChunk(chunk)}-${frame.id}`
        ),
        rarity: rarityForTier(tierForChunks([chunk])),
        surface,
        tags: [
          "pseudoword",
          "pseudo-seed",
          `pseudo-frame-${frame.id}`,
          `pseudo-focus-${slugForChunk(chunk)}`,
          `tier-${tierForChunks([chunk])}`
        ],
        targetable: true,
        tier: tierForChunks([chunk])
      });
    }
  }

  for (const legacy of LEGACY_SUPPLEMENTAL_PSEUDOWORDS) {
    const tier = tierForChunks([legacy.focusChunk]);
    mergeDefinition(definitionsBySurface, {
      family: "pseudo-bank",
      focusChunks: [legacy.focusChunk],
      id: idForSurface(
        legacy.surface,
        `pseudo-legacy-${slugForChunk(legacy.focusChunk)}`
      ),
      rarity: rarityForTier(tier),
      surface: legacy.surface,
      tags: [
        "pseudoword",
        "pseudo-legacy",
        `pseudo-focus-${slugForChunk(legacy.focusChunk)}`,
        `tier-${tier}`
      ],
      targetable: true,
      tier
    });
  }

  return [...definitionsBySurface.values()].map((definition) =>
    Object.freeze({
      family: definition.family,
      focusChunks: Object.freeze([...definition.focusChunks]),
      id: definition.id,
      rarity: definition.rarity,
      surface: definition.surface,
      tags: Object.freeze([
        ...definition.tags,
        ...(definition.targetable ? [] : ["targetable-false"])
      ]),
      targetable: definition.targetable,
      tier: definition.tier
    })
  );
}

function buildPseudowordConfusionClusters() {
  return KATAKANA_SPEED_MINIMAL_PSEUDO_PAIRS.map((pairDefinition) =>
    Object.freeze({
      id: `pseudo-pair-${pairDefinition.id}`,
      itemIds: Object.freeze([
        idForSurface(
          pairDefinition.targetSurface,
          `pseudo-pair-${pairDefinition.id}-target`
        ),
        idForSurface(
          pairDefinition.distractorSurface,
          `pseudo-pair-${pairDefinition.id}-distractor`
        )
      ])
    })
  );
}

function pairItemDefinition(input: {
  readonly chunk: string;
  readonly pairId: string;
  readonly role: "target" | "distractor";
  readonly surface: string;
  readonly targetable: boolean;
}): PseudowordDefinitionInput {
  const tier = tierForChunks([input.chunk]);

  return {
    family: "pseudo-bank",
    focusChunks: [input.chunk],
    id: idForSurface(
      input.surface,
      `pseudo-pair-${input.pairId}-${input.role}`
    ),
    rarity: rarityForTier(tier),
    surface: input.surface,
    tags: [
      "pseudoword",
      "pseudo-pair",
      `pseudo-pair-${input.pairId}`,
      `pseudo-pair-${input.role}`,
      `pseudo-focus-${slugForChunk(input.chunk)}`,
      `tier-${tier}`
    ],
    targetable: input.targetable,
    tier
  };
}

function mergeDefinition(
  definitionsBySurface: Map<string, MutablePseudowordDefinition>,
  nextDefinition: PseudowordDefinitionInput
) {
  const existing = definitionsBySurface.get(nextDefinition.surface);
  if (!existing) {
    definitionsBySurface.set(nextDefinition.surface, {
      family: nextDefinition.family,
      focusChunks: new Set(nextDefinition.focusChunks),
      id: idForSurface(nextDefinition.surface, nextDefinition.id),
      rarity: nextDefinition.rarity,
      surface: nextDefinition.surface,
      tags: new Set(nextDefinition.tags),
      targetable: nextDefinition.targetable,
      tier: nextDefinition.tier
    });

    return;
  }

  existing.id = idForSurface(nextDefinition.surface, existing.id);
  existing.rarity = maxRarity(existing.rarity, nextDefinition.rarity);
  existing.targetable ||= nextDefinition.targetable;
  existing.tier = maxTier(existing.tier, nextDefinition.tier);
  for (const focusChunk of nextDefinition.focusChunks) {
    existing.focusChunks.add(focusChunk);
  }
  for (const tag of nextDefinition.tags) {
    existing.tags.add(tag);
  }
  existing.tags.delete("targetable-false");
}

function idForSurface(surface: string, fallbackId: string) {
  return (
    LEGACY_PSEUDOWORD_IDS_BY_SURFACE[
      surface as keyof typeof LEGACY_PSEUDOWORD_IDS_BY_SURFACE
    ] ?? fallbackId
  );
}

function pair(
  id: string,
  targetChunk: string,
  distractorChunk: string,
  targetSurface: string,
  distractorSurface: string
) {
  return {
    distractorChunk,
    distractorSurface,
    id,
    targetChunk,
    targetSurface
  };
}

function slugForChunk(chunk: string) {
  const slug = CHUNK_SLUGS[chunk];
  if (!slug) {
    throw new Error(`Missing pseudoword chunk slug for ${chunk}`);
  }

  return slug;
}

function tierForChunks(
  chunks: readonly string[]
): Extract<KatakanaSpeedTier, "A" | "B" | "C"> {
  if (chunks.some((chunk) => C_TIER_CHUNKS.has(chunk))) {
    return "C";
  }
  if (chunks.some((chunk) => B_TIER_CHUNKS.has(chunk))) {
    return "B";
  }

  return "A";
}

function rarityForTier(tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">) {
  return tier === "C" ? "rare" : "edge";
}

function maxTier(
  left: Extract<KatakanaSpeedTier, "A" | "B" | "C">,
  right: Extract<KatakanaSpeedTier, "A" | "B" | "C">
): Extract<KatakanaSpeedTier, "A" | "B" | "C"> {
  const rank = { A: 0, B: 1, C: 2 } as const;

  return rank[left] >= rank[right] ? left : right;
}

function maxRarity(
  left: KatakanaSpeedRarity,
  right: KatakanaSpeedRarity
): KatakanaSpeedRarity {
  const rank = { core: 0, edge: 1, rare: 2 } as const;

  return rank[left] >= rank[right] ? left : right;
}
