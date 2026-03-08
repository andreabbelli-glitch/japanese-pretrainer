import { getGameById, getGames, getLanguageItemById, getProductsByGame, getUnitsByProduct } from '@/src/domain/content';
import { analyzeTargetGaps, getRequiredItemIdsForTarget } from '@/src/domain/learning';
import { computeMasteryFromProgress } from '@/src/domain/progress';
import type { GoalTarget } from '@/src/domain/learning';
import type { UserGoalRow, UserItemProgressRow } from '@/src/features/user-data/repository';

export type GoalOverview = {
  goal: UserGoalRow;
  target: GoalTarget;
  targetLabel: string;
  gap: ReturnType<typeof analyzeTargetGaps>;
};

export type GoalDashboardData = {
  activeGoal: GoalOverview | null;
  goalOverviews: GoalOverview[];
  globalCoverage: number;
  dueToday: number;
  weakButKnown: Array<{ id: string; surface: string; mastery: number }>;
  sharedKnowledgeReused: Array<{ itemId: string; surface: string; usedByProducts: number }>;
  studyNext: Array<{ itemId: string; surface: string; impact: number; unlockUnits: number }>;
};

const KNOWN_THRESHOLD = 80;
const WEAK_THRESHOLD = 50;

function parseGoalTarget(goal: UserGoalRow): GoalTarget {
  if (goal.target_type === 'custom') {
    return {
      id: goal.id,
      targetType: 'goal',
      itemIds: goal.linked_item_ids,
      title: goal.title,
    };
  }

  const target: GoalTarget = {
    id: goal.id,
    targetType: goal.target_type,
    title: goal.title,
  };

  if (goal.target_type === 'game' && goal.target_id) {
    target.gameId = goal.target_id;
  }

  if (goal.target_type === 'product' && goal.target_id) {
    const [gameId, productId] = goal.target_id.split('::');
    target.gameId = gameId;
    target.productId = productId;
  }

  if (goal.target_type === 'unit' && goal.target_id) {
    const [gameId, productId, unitId] = goal.target_id.split('::');
    target.gameId = gameId;
    target.productId = productId;
    target.unitId = unitId;
  }

  if (goal.linked_item_ids.length > 0) {
    target.itemIds = goal.linked_item_ids;
  }

  return target;
}

function targetLabel(target: GoalTarget) {
  if (target.targetType === 'goal') return 'Goal personalizzato';
  if (target.targetType === 'game' && target.gameId) return getGameById(target.gameId)?.name ?? target.gameId;
  if (target.targetType === 'product' && target.gameId && target.productId) {
    return getProductsByGame(target.gameId).find((product) => product.id === target.productId)?.name ?? target.productId;
  }
  if (target.targetType === 'unit' && target.gameId && target.productId && target.unitId) {
    return getUnitsByProduct(target.gameId, target.productId).find((unit) => unit.id === target.unitId)?.name ?? target.unitId;
  }
  return target.title ?? 'Target';
}

export function buildGoalDashboardData(input: {
  goals: UserGoalRow[];
  progressRows: UserItemProgressRow[];
  now?: Date;
}): GoalDashboardData {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  const masteryMap = new Map<string, number>();
  for (const row of input.progressRows) {
    masteryMap.set(row.item_id, computeMasteryFromProgress(row, now).score);
  }

  const goalOverviews = input.goals.map((goal) => {
    const target = parseGoalTarget(goal);
    return {
      goal,
      target,
      targetLabel: targetLabel(target),
      gap: analyzeTargetGaps(target, masteryMap),
    };
  });

  const activeGoal = goalOverviews.find((entry) => entry.goal.status === 'active') ?? null;

  const dueToday = input.progressRows.filter((row) => row.due_at && row.due_at.slice(0, 10) <= today).length;

  const weakButKnown = Array.from(masteryMap.entries())
    .filter(([, mastery]) => mastery >= WEAK_THRESHOLD && mastery < KNOWN_THRESHOLD)
    .map(([itemId, mastery]) => ({ itemId, mastery }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 10)
    .map((entry) => ({
      id: entry.itemId,
      mastery: entry.mastery,
      surface: getLanguageItemById(entry.itemId)?.surface ?? entry.itemId,
    }));

  const itemReuseCounter = new Map<string, Set<string>>();
  for (const game of getGames()) {
    for (const product of getProductsByGame(game.id)) {
      const itemIds = getRequiredItemIdsForTarget({
        id: `reuse.${product.id}`,
        targetType: 'product',
        gameId: game.id,
        productId: product.id,
      });
      for (const itemId of itemIds) {
        const set = itemReuseCounter.get(itemId) ?? new Set<string>();
        set.add(product.id);
        itemReuseCounter.set(itemId, set);
      }
    }
  }

  const sharedKnowledgeReused = Array.from(itemReuseCounter.entries())
    .filter(([, products]) => products.size > 1)
    .map(([itemId, products]) => ({
      itemId,
      usedByProducts: products.size,
      surface: getLanguageItemById(itemId)?.surface ?? itemId,
    }))
    .sort((a, b) => b.usedByProducts - a.usedByProducts)
    .slice(0, 8);

  const focusGoals = activeGoal ? [activeGoal] : goalOverviews.filter((goal) => goal.goal.status !== 'archived').slice(0, 2);
  const studyNext = focusGoals
    .flatMap((goal) =>
      goal.gap.unlockNextRecommendations.map((entry) => ({
        itemId: entry.item.id,
        surface: entry.item.surface,
        impact: entry.impactScore,
        unlockUnits: entry.unlocks.length,
      })),
    )
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 8);

  const allCoverage = goalOverviews.map((entry) => entry.gap.coverageScore);
  const globalCoverage = allCoverage.length > 0 ? Math.round(allCoverage.reduce((sum, value) => sum + value, 0) / allCoverage.length) : 0;

  return {
    activeGoal,
    goalOverviews,
    globalCoverage,
    dueToday,
    weakButKnown,
    sharedKnowledgeReused,
    studyNext,
  };
}
