import {
  getGameById,
  getLanguageItemById,
  getProductsByGame,
  getUnitById,
  getUnitsByProduct,
} from '@/src/domain/content';
import type { GoalTarget, CoverageResult } from '@/src/domain/learning/types';

const ITEM_WEIGHT: Record<string, number> = {
  core: 3,
  important: 2,
  nice: 1,
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function getRequiredItemIdsForTarget(target: GoalTarget): string[] {
  if (target.targetType === 'goal' && target.itemIds) {
    return unique(target.itemIds);
  }

  if (target.targetType === 'unit' && target.gameId && target.productId && target.unitId) {
    const unit = getUnitById(target.gameId, target.productId, target.unitId);
    return unique(unit?.requiredItemIds ?? []);
  }

  if (target.targetType === 'product' && target.gameId && target.productId) {
    return unique(
      getUnitsByProduct(target.gameId, target.productId)
        .flatMap((unit) => unit.requiredItemIds),
    );
  }

  if (target.targetType === 'game' && target.gameId) {
    const products = getProductsByGame(target.gameId);
    return unique(
      products.flatMap((product) => getUnitsByProduct(target.gameId!, product.id)).flatMap((unit) => unit.requiredItemIds),
    );
  }

  return [];
}

export function computeCoverage(target: GoalTarget, masteryByItemId: Map<string, number>): CoverageResult {
  if (target.targetType === 'game' && target.gameId && !getGameById(target.gameId)) {
    return {
      target,
      coverageScore: 0,
      requiredItems: [],
      weightedMasterySum: 0,
      weightedMax: 0,
      items: [],
    };
  }

  const requiredItemIds = getRequiredItemIdsForTarget(target);
  const requiredItems = requiredItemIds
    .map((itemId) => getLanguageItemById(itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const items = requiredItems.map((item) => {
    const mastery = masteryByItemId.get(item.id) ?? 0;
    const weight = ITEM_WEIGHT[item.priority] ?? 1;
    return {
      item,
      mastery,
      weight,
      weightedMastery: mastery * weight,
    };
  });

  const weightedMasterySum = items.reduce((sum, item) => sum + item.weightedMastery, 0);
  const weightedMax = items.reduce((sum, item) => sum + item.weight * 100, 0);

  return {
    target,
    coverageScore: weightedMax > 0 ? Math.round((weightedMasterySum / weightedMax) * 100) : 0,
    requiredItems,
    weightedMasterySum,
    weightedMax,
    items,
  };
}
