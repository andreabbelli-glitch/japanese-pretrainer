import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsPage } from "@/components/settings/settings-page";
import type { FsrsOptimizerStatus } from "@/lib/fsrs-optimizer";

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
  it("renders logout only as the final account setting when auth is enabled", () => {
    clearAuthEnv();
    process.env.AUTH_USERNAME = "owner";
    process.env.AUTH_PASSWORD = "study-hard";
    process.env.AUTH_SESSION_SECRET = "super-secret-session-key";

    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        fsrsOptimizerStatus: buildFsrsOptimizerStatus(),
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Preferenze di studio");
    expect(markup).toContain("Salva preferenze");
    expect(markup).toContain("Furigana sul fronte");
    expect(markup).toContain("Solo dopo risposta");
    expect(markup).toContain("FSRS optimizer");
    expect(markup).toContain("Desired retention");
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
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
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
        saved: false,
        settings: {
          furiganaMode: "hover",
          glossaryDefaultSort: "lesson_order",
          reviewFrontFurigana: true,
          reviewDailyLimit: 20
        }
      })
    );

    expect(markup).toContain("Stato optimizer");
    expect(markup).toContain("Disattivato");
    expect(markup).toContain("pnpm fsrs:optimize");
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
