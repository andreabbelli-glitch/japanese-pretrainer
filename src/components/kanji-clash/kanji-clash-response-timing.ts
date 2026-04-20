export type KanjiClashRoundResponseTimer = {
  getResponseMs(now: number): number | null;
  markRoundPresented(roundKey: string, now: number): void;
};

export function createKanjiClashRoundResponseTimer(): KanjiClashRoundResponseTimer {
  let presentedRoundKey: string | null = null;
  let startedAt: number | null = null;

  return {
    getResponseMs(now: number) {
      if (startedAt === null) {
        return null;
      }

      return Math.max(0, Math.round(now - startedAt));
    },
    markRoundPresented(roundKey: string, now: number) {
      if (presentedRoundKey === roundKey) {
        return;
      }

      presentedRoundKey = roundKey;
      startedAt = now;
    }
  };
}
