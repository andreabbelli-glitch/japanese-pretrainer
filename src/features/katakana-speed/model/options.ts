import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemById
} from "./catalog.ts";

export function generateKatakanaSpeedOptions(input: {
  count: number;
  seed: string;
  targetItemId: string;
}): string[] {
  const target = getKatakanaSpeedItemById(input.targetItemId);
  if (!target || input.count <= 0) {
    return [];
  }

  const selected = new Set([target.id]);
  const confusionDistractors = target.distractorItemIds.filter((itemId) => {
    const candidate = getKatakanaSpeedItemById(itemId);
    return candidate?.confusionClusterIds.some((clusterId) =>
      target.confusionClusterIds.includes(clusterId)
    );
  });
  const sameFamilyDistractors = getKatakanaSpeedCatalog()
    .filter((item) => item.id !== target.id && item.family === target.family)
    .sort((left, right) => rarityRank(left.rarity) - rarityRank(right.rarity))
    .map((item) => item.id);
  const fallbackDistractors = getKatakanaSpeedCatalog()
    .filter((item) => item.id !== target.id)
    .map((item) => item.id);

  fillSelected(
    selected,
    stableShuffle(confusionDistractors, `${input.seed}:c`),
    input.count
  );
  fillSelected(
    selected,
    stableShuffleByRarity(sameFamilyDistractors, `${input.seed}:f`),
    input.count
  );
  fillSelected(
    selected,
    stableShuffle(fallbackDistractors, `${input.seed}:a`),
    input.count
  );

  return stableShuffle([...selected], `${input.seed}:final`).slice(
    0,
    input.count
  );
}

function rarityRank(rarity: "core" | "edge" | "rare") {
  if (rarity === "core") {
    return 0;
  }
  if (rarity === "edge") {
    return 1;
  }

  return 2;
}

function stableShuffleByRarity(itemIds: readonly string[], seed: string) {
  const byRarity = {
    core: itemIds.filter(
      (itemId) => getKatakanaSpeedItemById(itemId)?.rarity === "core"
    ),
    edge: itemIds.filter(
      (itemId) => getKatakanaSpeedItemById(itemId)?.rarity === "edge"
    ),
    rare: itemIds.filter(
      (itemId) =>
        (getKatakanaSpeedItemById(itemId)?.rarity ?? "rare") === "rare"
    )
  };

  return [
    ...stableShuffle(byRarity.core, `${seed}:core`),
    ...stableShuffle(byRarity.edge, `${seed}:edge`),
    ...stableShuffle(byRarity.rare, `${seed}:rare`)
  ];
}

function fillSelected(
  selected: Set<string>,
  candidates: readonly string[],
  count: number
) {
  for (const candidate of candidates) {
    if (selected.size >= count) {
      return;
    }
    selected.add(candidate);
  }
}

export function stableShuffle<T>(values: readonly T[], seed: string): T[] {
  return values
    .map((value, index) => ({
      index,
      rank: hashString(`${seed}:${index}:${String(value)}`),
      value
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ value }) => value);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
