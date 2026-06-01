import type {
  KatakanaSpeedConfusionCluster,
  KatakanaSpeedItem,
  KatakanaSpeedTier
} from "../types.ts";
import {
  countKatakanaMora,
  tokenizeKatakanaDisplaySegments
} from "./tokenizer.ts";
import mediaWordBankJson from "./media-word-bank.json";
import {
  buildKatakanaSpeedPseudowordCatalog,
  buildKatakanaSpeedPseudowordConfusionClusters,
  type KatakanaSpeedPseudowordCatalogDefinition
} from "./pseudoword-catalog.ts";
import { getKatakanaSpeedOperationalWordSurfaces } from "./exercise-catalog.ts";
import {
  KATAKANA_SPEED_B_TIER_CHUNKS,
  KATAKANA_SPEED_C_TIER_CHUNKS,
  KATAKANA_SPEED_MANUAL_WORD_ROWS,
  KATAKANA_SPEED_OPERATIONAL_FOCUS_CHUNKS,
  KATAKANA_SPEED_STATIC_CLUSTER_ROWS,
  KATAKANA_SPEED_STATIC_ITEM_ROWS,
  type KatakanaSpeedManualWordRow,
  type KatakanaSpeedStaticClusterRow,
  type KatakanaSpeedStaticItemRow
} from "./catalog-static-data.ts";
import {
  KATAKANA_SPEED_SENTENCE_ROWS,
  type KatakanaSpeedSentenceRow
} from "./sentence-bank.ts";

export {
  generateKatakanaSpeedPseudoWord,
  generateKatakanaSpeedPseudoWords
} from "./pseudo.ts";

type CatalogItemDefinition = Omit<
  KatakanaSpeedItem,
  "confusionClusterIds" | "distractorItemIds"
>;

type ItemOptions = {
  readonly focusChunks?: readonly string[];
  readonly isPseudo?: boolean;
  readonly meaningIt?: string;
  readonly sentenceId?: string;
  readonly tags?: readonly string[];
  readonly targetRtMs?: number;
};

const B_TIER_CHUNKS: ReadonlySet<string> = new Set(
  KATAKANA_SPEED_B_TIER_CHUNKS
);
const C_TIER_CHUNKS: ReadonlySet<string> = new Set(
  KATAKANA_SPEED_C_TIER_CHUNKS
);
const MANUAL_WORD_SURFACES = new Set(
  KATAKANA_SPEED_MANUAL_WORD_ROWS.map((wordRow) => wordRow.surface)
);

const itemDefinitions = [
  ...KATAKANA_SPEED_STATIC_ITEM_ROWS.map(staticItemFromRow),
  ...KATAKANA_SPEED_MANUAL_WORD_ROWS.map(manualWordFromRow),
  ...operationalWordDefinitions(),
  ...mediaWordDefinitions(),
  ...buildKatakanaSpeedPseudowordCatalog().map(pseudowordFromCatalog),
  ...KATAKANA_SPEED_SENTENCE_ROWS.map(sentenceFromRow)
];

const clusterDefinitions = [
  ...KATAKANA_SPEED_STATIC_CLUSTER_ROWS.map(staticClusterFromRow),
  ...buildKatakanaSpeedPseudowordConfusionClusters().map((confusionCluster) =>
    cluster("minimal-" + confusionCluster.id, "phonological", [
      ...confusionCluster.itemIds
    ])
  )
];

const clustersByItem = new Map<string, string[]>();

for (const confusionCluster of clusterDefinitions) {
  for (const itemId of confusionCluster.itemIds) {
    clustersByItem.set(itemId, [
      ...(clustersByItem.get(itemId) ?? []),
      confusionCluster.id
    ]);
  }
}

const catalog = Object.freeze(
  itemDefinitions.map((definition) => {
    const confusionClusterIds = clustersByItem.get(definition.id) ?? [];
    const distractorItemIds = buildDistractors(
      definition.id,
      confusionClusterIds
    );

    return Object.freeze({
      ...definition,
      confusionClusterIds: Object.freeze(confusionClusterIds),
      displaySegments: Object.freeze([...definition.displaySegments]),
      distractorItemIds: Object.freeze(distractorItemIds),
      focusChunks: Object.freeze([...definition.focusChunks]),
      tags: Object.freeze([...definition.tags])
    });
  })
);

const catalogById = new Map(
  catalog.map((catalogItem) => [catalogItem.id, catalogItem])
);
const catalogBySurface = new Map(
  catalog.map((catalogItem) => [catalogItem.surface, catalogItem])
);
const confusionClusters = Object.freeze(
  clusterDefinitions.map((confusionCluster) => Object.freeze(confusionCluster))
);
const confusionClustersById = new Map(
  confusionClusters.map((confusionCluster) => [
    confusionCluster.id,
    confusionCluster
  ])
);

export function getKatakanaSpeedCatalog(): readonly KatakanaSpeedItem[] {
  return catalog;
}

export function getKatakanaSpeedConfusionClusters(): readonly KatakanaSpeedConfusionCluster[] {
  return confusionClusters;
}

export function getKatakanaSpeedItemById(
  itemId: string
): KatakanaSpeedItem | undefined {
  return catalogById.get(itemId);
}

export function getKatakanaSpeedItemBySurface(
  surface: string
): KatakanaSpeedItem | undefined {
  return catalogBySurface.get(surface);
}

export function getKatakanaSpeedConfusionClusterById(
  clusterId: string
): KatakanaSpeedConfusionCluster | undefined {
  return confusionClustersById.get(clusterId);
}

function staticItemFromRow(row: KatakanaSpeedStaticItemRow) {
  return item(
    row.id,
    row.surface,
    row.reading,
    row.family,
    row.kind,
    row.rarity,
    row.tier
  );
}

function manualWordFromRow(row: KatakanaSpeedManualWordRow) {
  return word(row.id, row.surface, row.tier, row.focusChunks, row.meaningIt);
}

function staticClusterFromRow(row: KatakanaSpeedStaticClusterRow) {
  return cluster(row.id, row.kind, row.itemIds);
}

function sentenceFromRow(row: KatakanaSpeedSentenceRow) {
  return sentence(row.id, row.surface, row.focusChunks);
}

function word(
  id: string,
  surface: string,
  tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">,
  focusChunks: readonly string[],
  meaningIt: string
) {
  return item(id, surface, surface, "word-bank", "word", "core", tier, {
    focusChunks,
    meaningIt,
    tags: ["word", `tier-${tier}`],
    targetRtMs: 1450
  });
}

function operationalWordDefinitions() {
  return getKatakanaSpeedOperationalWordSurfaces()
    .filter((surface) => !MANUAL_WORD_SURFACES.has(surface))
    .map((surface) => {
      const focusChunks = inferOperationalFocusChunks(surface);
      const tier = resolveTier(focusChunks);
      const tags = [
        "word",
        "operational-word-bank",
        `tier-${tier}`,
        ...featureTagsForSurface(surface)
      ];

      return item(
        `word-bank-${hashSurface(surface)}`,
        surface,
        surface,
        "loanword-bank",
        "word",
        tier === "C" ? "rare" : tier === "B" ? "edge" : "core",
        tier,
        {
          focusChunks,
          tags,
          targetRtMs: 1450
        }
      );
    });
}

function mediaWordDefinitions() {
  const reservedSurfaces = new Set([
    ...MANUAL_WORD_SURFACES,
    ...getKatakanaSpeedOperationalWordSurfaces()
  ]);
  const seenSurfaces = new Set<string>();

  return Object.entries(mediaWordBankJson).flatMap(([sourceSlug, surfaces]) =>
    surfaces.flatMap((surface) => {
      const normalizedSurface = surface.normalize("NFKC").trim();
      if (
        !normalizedSurface ||
        countKatakanaMora(normalizedSurface) === 0 ||
        reservedSurfaces.has(normalizedSurface) ||
        seenSurfaces.has(normalizedSurface)
      ) {
        return [];
      }

      seenSurfaces.add(normalizedSurface);
      const focusChunks = inferOperationalFocusChunks(normalizedSurface);
      const tier = resolveTier(focusChunks);
      const sourceTag =
        sourceSlug === "custom" ? "custom-word-bank" : "media-word-bank";
      const tags = [
        "word",
        sourceTag,
        `${sourceSlug === "custom" ? "custom" : "media"}:${sourceSlug}`,
        `tier-${tier}`,
        ...featureTagsForSurface(normalizedSurface)
      ];

      return item(
        `${sourceSlug === "custom" ? "custom" : "media"}-word-${sourceSlug}-${hashSurface(normalizedSurface)}`,
        normalizedSurface,
        normalizedSurface,
        `${sourceSlug === "custom" ? "custom" : "media"}-word-bank`,
        "word",
        "edge",
        tier,
        {
          focusChunks,
          tags,
          targetRtMs: Math.max(1600, 280 * countKatakanaMora(normalizedSurface))
        }
      );
    })
  );
}

function pseudowordFromCatalog(
  definition: KatakanaSpeedPseudowordCatalogDefinition
) {
  return item(
    definition.id,
    definition.surface,
    definition.surface,
    definition.family,
    "pseudoword",
    definition.rarity,
    definition.tier,
    {
      focusChunks: definition.focusChunks,
      isPseudo: true,
      tags: definition.tags,
      targetRtMs: 1500
    }
  );
}

function sentence(id: string, surface: string, focusChunks: readonly string[]) {
  const tier = resolveTier(focusChunks);

  return item(
    `sentence-${id}`,
    surface,
    surface,
    "sentence-sprint",
    "sentence",
    "edge",
    tier,
    {
      focusChunks,
      sentenceId: id,
      tags: ["sentence", `tier-${tier}`],
      targetRtMs: 3200
    }
  );
}

function item(
  id: string,
  surface: string,
  reading: string,
  family: string,
  kind: KatakanaSpeedItem["kind"],
  rarity: KatakanaSpeedItem["rarity"],
  tier: KatakanaSpeedTier,
  options: ItemOptions = {}
): CatalogItemDefinition {
  const focusChunks = options.focusChunks ?? defaultFocusChunks(kind, surface);
  const tags = options.tags ?? [kind, `tier-${tier}`];

  return {
    displaySegments: tokenizeKatakanaDisplaySegments(surface),
    family,
    focusChunks,
    id,
    ...(options.isPseudo ? { isPseudo: true } : {}),
    kind,
    ...(options.meaningIt ? { meaningIt: options.meaningIt } : {}),
    moraCount: countKatakanaMora(surface),
    rarity,
    reading,
    ...(options.sentenceId ? { sentenceId: options.sentenceId } : {}),
    surface,
    tags,
    targetRtMs: options.targetRtMs ?? targetRtMsFor(rarity, kind),
    tier
  };
}

function cluster(
  id: string,
  kind: KatakanaSpeedConfusionCluster["kind"],
  itemIds: readonly string[]
): KatakanaSpeedConfusionCluster {
  return {
    id,
    itemIds: Object.freeze([...itemIds]),
    kind
  };
}

function buildDistractors(itemId: string, clusterIds: readonly string[]) {
  const distractors = new Set<string>();
  for (const clusterId of clusterIds) {
    const confusionCluster = clusterDefinitions.find(
      (candidate) => candidate.id === clusterId
    );
    for (const clusterItemId of confusionCluster?.itemIds ?? []) {
      if (clusterItemId !== itemId) {
        distractors.add(clusterItemId);
      }
    }
  }

  const target = itemDefinitions.find((candidate) => candidate.id === itemId);
  for (const candidate of itemDefinitions) {
    if (candidate.id !== itemId && candidate.family === target?.family) {
      distractors.add(candidate.id);
    }
  }

  return [...distractors];
}

function defaultFocusChunks(kind: KatakanaSpeedItem["kind"], surface: string) {
  return kind === "extended_chunk" ? [surface] : [];
}

function inferOperationalFocusChunks(surface: string) {
  return KATAKANA_SPEED_OPERATIONAL_FOCUS_CHUNKS.filter((chunk) =>
    surface.includes(chunk)
  );
}

function featureTagsForSurface(surface: string) {
  const tags: string[] = [];
  if (surface.includes("ー")) {
    tags.push("long-vowel");
  }
  if (surface.includes("ッ")) {
    tags.push("sokuon");
  }
  if (surface.includes("ン")) {
    tags.push("nasal-n");
  }
  if (/[ァィゥェォ]/u.test(surface)) {
    tags.push("small-vowel");
  }
  if (/[ャュョ]/u.test(surface)) {
    tags.push("small-yoon");
  }
  if (/[ガギグゲゴザジズゼゾダヂヅデドバビブベボヴ]/u.test(surface)) {
    tags.push("dakuon");
  }
  if (/[パピプペポ]/u.test(surface)) {
    tags.push("handakuon");
  }
  if (surface.includes("・")) {
    tags.push("middle-dot");
  }

  return tags;
}

function hashSurface(surface: string) {
  let hash = 2166136261;
  for (const char of surface) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function targetRtMsFor(
  rarity: KatakanaSpeedItem["rarity"],
  kind: KatakanaSpeedItem["kind"]
) {
  if (kind === "sentence") {
    return 3200;
  }
  if (kind === "word" || kind === "pseudoword") {
    return 1500;
  }

  return rarity === "rare" ? 1300 : rarity === "edge" ? 1150 : 950;
}

function resolveTier(
  focusChunks: readonly string[]
): Extract<KatakanaSpeedTier, "A" | "B" | "C"> {
  if (focusChunks.some((chunk) => C_TIER_CHUNKS.has(chunk))) {
    return "C";
  }
  if (focusChunks.some((chunk) => B_TIER_CHUNKS.has(chunk))) {
    return "B";
  }

  return "A";
}
