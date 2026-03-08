import { getLanguageItemById, getProductsByGame, getUnitById, getUnitsByProduct } from '@/src/domain/content';
import { computeCoverage, getRequiredItemIdsForTarget } from '@/src/domain/learning/coverage';
import type { GapAnalysisResult, GoalTarget, UnlockRecommendation } from '@/src/domain/learning/types';

const KNOWN_THRESHOLD = 80;
const WEAK_THRESHOLD = 50;

export function recommendUnlockNext(target: GoalTarget, masteryByItemId: Map<string, number>, limit = 5): UnlockRecommendation[] {
  if (!target.gameId) return [];

  const candidateUnits = target.targetType === 'unit' && target.productId && target.unitId
    ? [getUnitById(target.gameId, target.productId, target.unitId)].filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    : target.targetType === 'product' && target.productId
      ? getUnitsByProduct(target.gameId, target.productId)
      : target.targetType === 'game'
        ? getProductsByGame(target.gameId).flatMap((product) => getUnitsByProduct(target.gameId!, product.id))
        : [];

  const requiredItemIds = getRequiredItemIdsForTarget(target);
  const candidateItems = requiredItemIds
    .map((itemId) => getLanguageItemById(itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => (masteryByItemId.get(item.id) ?? 0) < KNOWN_THRESHOLD);

  return candidateItems
    .map((item) => {
      const unlocks = candidateUnits.filter((unit) => unit.requiredItemIds.includes(item.id));
      const avgGap = Math.max(0, 100 - (masteryByItemId.get(item.id) ?? 0));
      const impactScore = unlocks.length * avgGap;
      return {
        item,
        impactScore,
        unlocks,
      };
    })
    .filter((entry) => entry.unlocks.length > 0)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, limit);
}

export function analyzeTargetGaps(target: GoalTarget, masteryByItemId: Map<string, number>): GapAnalysisResult {
  const coverage = computeCoverage(target, masteryByItemId);
  const knownItems = coverage.requiredItems.filter((item) => (masteryByItemId.get(item.id) ?? 0) >= KNOWN_THRESHOLD);
  const weakItems = coverage.requiredItems.filter((item) => {
    const mastery = masteryByItemId.get(item.id) ?? 0;
    return mastery >= WEAK_THRESHOLD && mastery < KNOWN_THRESHOLD;
  });
  const missingItems = coverage.requiredItems.filter((item) => (masteryByItemId.get(item.id) ?? 0) < WEAK_THRESHOLD);

  return {
    target,
    requiredItems: coverage.requiredItems,
    knownItems,
    weakItems,
    missingItems,
    coverageScore: coverage.coverageScore,
    unlockNextRecommendations: recommendUnlockNext(target, masteryByItemId),
  };
}
