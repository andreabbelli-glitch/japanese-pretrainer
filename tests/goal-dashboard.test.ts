import { describe, expect, it } from 'vitest';
import { buildGoalDashboardData } from '@/src/domain/goals/dashboard';

describe('goal dashboard domain', () => {
  it('costruisce moduli dashboard da goal e progress reali', () => {
    const data = buildGoalDashboardData({
      goals: [
        {
          id: 'g1',
          user_id: 'u1',
          title: 'Capire SD1',
          description: null,
          target_type: 'product',
          target_id: 'game.duel-masters::product.dm25-sd1',
          linked_item_ids: [],
          status: 'active',
          priority: 3,
          due_at: null,
          started_at: null,
          completed_at: null,
          archived_at: null,
          archive_reason: null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      progressRows: [
        {
          id: 'p1',
          user_id: 'u1',
          item_id: 'V-005',
          state: 'review',
          due_at: new Date().toISOString(),
          last_reviewed_at: new Date().toISOString(),
          interval_days: 5,
          ease_factor: 2.5,
          reps: 3,
          lapses: 0,
          streak: 2,
          mastery_score: 0,
          last_rating: 'Good',
          content_version: 'v1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      now: new Date(),
    });

    expect(data.goalOverviews.length).toBe(1);
    expect(data.activeGoal?.goal.id).toBe('g1');
    expect(data.globalCoverage).toBeGreaterThanOrEqual(0);
    expect(data.globalCoverage).toBeLessThanOrEqual(100);
  });
});
