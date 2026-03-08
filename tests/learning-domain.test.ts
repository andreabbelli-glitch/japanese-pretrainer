import { describe, expect, it } from 'vitest';
import { analyzeTargetGaps, computeCoverage } from '../src/domain/learning';

describe('learning domain engines', () => {
  it('calcola coverage per target product in range 0-100', () => {
    const mastery = new Map<string, number>([
      ['jp.v.005', 95],
      ['jp.v.007', 80],
      ['jp.v.009', 65],
    ]);

    const result = computeCoverage(
      {
        id: 'goal.product.sd1',
        targetType: 'product',
        gameId: 'game.duel-masters',
        productId: 'product.dm25-sd1',
      },
      mastery,
    );

    expect(result.requiredItems.length).toBeGreaterThan(0);
    expect(result.coverageScore).toBeGreaterThanOrEqual(0);
    expect(result.coverageScore).toBeLessThanOrEqual(100);
  });

  it('ritorna gap analysis con sezioni richieste e raccomandazioni', () => {
    const mastery = new Map<string, number>();
    const gap = analyzeTargetGaps(
      {
        id: 'goal.product.sd2',
        targetType: 'product',
        gameId: 'game.duel-masters',
        productId: 'product.dm25-sd2',
      },
      mastery,
    );

    expect(gap.requiredItems.length).toBeGreaterThan(0);
    expect(gap.missingItems.length).toBeGreaterThan(0);
    expect(gap.coverageScore).toBe(0);
    expect(Array.isArray(gap.unlockNextRecommendations)).toBe(true);
  });
});
