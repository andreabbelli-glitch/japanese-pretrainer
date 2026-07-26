import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsPage } from "@/components/settings/settings-page";
import { FsrsOptimizerStatusPanel } from "@/components/settings/fsrs-optimizer-status-panel";
import type { FsrsOptimizerStatus } from "@/features/fsrs-optimizer/server";

const AUTH_ENV_KEYS = [
  "AUTH_PASSWORD",
  "AUTH_PASSWORD_HASH",
  "AUTH_SESSION_SECRET",
  "AUTH_USERNAME"
] as const;

const originalAuthEnv = new Map<string, string | undefined>(
  AUTH_ENV_KEYS.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of AUTH_ENV_KEYS) {
    const value = originalAuthEnv.get(key);

    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
});

describe("settings page", () => {
  it("shows global and per-preset optimizer failures", () => {
    const status = buildFsrsOptimizerStatus();

    status.state.lastTrainingError = "All evaluated presets failed.";
    status.presets.recognition.lastError = "Recognition timeout.";
    status.presets.concept.lastError = "Concept optimizer failed.";

    const markup = renderToStaticMarkup(
      createElement(FsrsOptimizerStatusPanel, { status })
    );

    expect(markup).toContain(
      "Ultimo errore training: All evaluated presets failed."
    );
    expect(markup).toContain("Ultimo errore del preset: Recognition timeout.");
    expect(markup).toContain(
      "Ultimo errore del preset: Concept optimizer failed."
    );
  });

  it("renders logout only as the final account setting when auth is enabled", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD = "study-hard";
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        fsrsReschedulePreview: buildFsrsReschedulePreview(),
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Preferenze di studio");
    expect(markup).toContain("Salva preferenze");
    expect(markup).toContain("Audio alla risposta");
    expect(markup).toContain("Riproduci subito");
    expect(markup).toContain("Furigana sul fronte");
    expect(markup).toContain("Solo dopo risposta");
    expect(markup).toContain("Kanji Clash");
    expect(markup).toContain("Nuove coppie al giorno");
    expect(markup).toContain("Dimensione predefinita drill manuale");
    expect(markup).toContain("FSRS optimizer");
    expect(markup).toContain("Desired retention");
    expect(markup).toContain("Riallineamento calendario FSRS");
    expect(markup).toContain("Applica riallineamento FSRS");
    expect(markup).toContain("Delta 7 giorni");
    expect(markup).toContain("2026-01-21");
    expect(markup).toContain(
      'aria-label="Impatto giornaliero del riallineamento FSRS"'
    );
    expect(markup).toContain("Esci dall&#x27;account");
    expect(markup).toContain(">Esci<");
    expect(markup.indexOf("Salva preferenze")).toBeLessThan(
      markup.indexOf("Esci dall&#x27;account")
    );
  });

  it("omits the account section when auth is disabled", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        fsrsReschedulePreview: buildFsrsReschedulePreview(),
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).not.toContain("Esci dall&#x27;account");
    expect(markup).not.toContain(">Esci<");
  });

  it("shows when the optimizer is disabled while remaining read-only", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus({
          enabled: false
        }),
        fsrsReschedulePreview: buildFsrsReschedulePreview(),
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Stato optimizer");
    expect(markup).toContain("Disattivato");
    expect(markup).toContain("pnpm fsrs:optimize");
  });

  it("loads the expensive FSRS reschedule preview only on request", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        fsrsReschedulePreview: null,
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Calcola preview FSRS");
    expect(markup).toContain("/settings?fsrsPreview=1");
    expect(markup).not.toContain("Impatto giornaliero");
  });

  it("preserves a valid persisted review daily limit outside the preset list", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        fsrsReschedulePreview: buildFsrsReschedulePreview(),
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 7
        }
      })
    );

    expect(markup).toContain('<option value="7" selected="">7 nuove</option>');
  });

  it("shows FSRS reschedule action feedback notices", () => {
    clearAuthEnv();

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        fsrsReschedulePreview: buildFsrsReschedulePreview({
          affectedSubjects: 0
        }),
        fsrsRescheduleStatus: "applied",
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          kanjiClashDailyNewLimit: 5,
          kanjiClashDefaultScope: "global",
          kanjiClashManualDefaultSize: 20,
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Calendario FSRS riallineato.");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Nessuna card da riallineare");
  });
});

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    delete process.env[key];
  }
}

function buildFsrsOptimizerStatus(
  overrides: Partial<FsrsOptimizerStatus["config"]> = {}
): FsrsOptimizerStatus {
  return {
    config: {
      desiredRetention: 0.9,
      enabled: true,
      minDaysBetweenRuns: 30,
      minNewReviews: 500,
      presetStrategy: "card_type_v1",
      ...overrides
    },
    newEligibleReviews: 42,
    nextTrainingNewReviewThreshold: 500,
    presets: {
      concept: {
        desiredRetention: 0.9,
        presetKey: "concept",
        trainedAt: "2026-04-01T10:00:00.000Z",
        trainingReviewCount: 120,
        usesOptimizedParameters: true
      },
      recognition: {
        desiredRetention: 0.9,
        presetKey: "recognition",
        trainedAt: null,
        trainingReviewCount: 0,
        usesOptimizedParameters: false
      }
    },
    state: {
      bindingVersion: "0.3.0",
      lastAttemptAt: "2026-04-01T10:00:00.000Z",
      lastCheckAt: "2026-04-01T10:00:00.000Z",
      lastSuccessfulTrainingAt: "2026-04-01T10:00:00.000Z",
      lastTrainingError: null,
      newEligibleReviewsSinceLastTraining: 42,
      totalEligibleReviewsAtLastTraining: 500
    },
    totalEligibleReviews: 542
  };
}

function buildFsrsReschedulePreview(
  overrides: Partial<{
    affectedSubjects: number;
  }> = {}
) {
  const affectedSubjects = overrides.affectedSubjects ?? 2;

  return {
    days: [
      {
        currentCount: 1,
        date: "2026-01-21",
        delta: -1,
        proposedCount: 0
      },
      {
        currentCount: 1,
        date: "2026-01-22",
        delta: 2,
        proposedCount: 3
      }
    ],
    fsrsCacheKeyPart: "config|recognition|concept",
    generatedAt: "2026-01-21T10:00:00.000Z",
    horizonDays: 30,
    summary: {
      affectedSubjects,
      currentDue30Days: 2,
      currentDue7Days: 2,
      currentDueToday: 1,
      delta30Days: 1,
      delta7Days: 1,
      deltaDueToday: -1,
      eligibleSubjects: 5,
      movedEarlier: 1,
      movedLater: 1,
      proposedDue30Days: 3,
      proposedDue7Days: 3,
      proposedDueToday: 0,
      skippedNoHistory: 0,
      unchangedSubjects: 3
    }
  };
}
