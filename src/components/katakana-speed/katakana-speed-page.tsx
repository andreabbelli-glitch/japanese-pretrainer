"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { startKatakanaSpeedSessionAction } from "@/actions/katakana-speed";
import type {
  KatakanaSpeedManualExercise,
  KatakanaSpeedPageData,
  KatakanaSpeedSessionMode
} from "@/features/katakana-speed/server";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  KATAKANA_SPEED_MANUAL_EXERCISE_ACTIONS,
  KATAKANA_SPEED_PRIMARY_ACTIONS
} from "./katakana-speed-copy";
import {
  ConfusionList,
  FamilyCards,
  formatDuration,
  formatPercent,
  SlowList
} from "./katakana-speed-shared";

type KatakanaSpeedPageProps = {
  data: KatakanaSpeedPageData;
};

export function KatakanaSpeedPage({ data }: KatakanaSpeedPageProps) {
  const router = useRouter();
  const [startingActionKey, setStartingActionKey] = useState<string | null>(
    null
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const recommendedMode = data.analytics.recommendedMode;
  const recentHref: Route | null = data.recentSession
    ? ((data.recentSession.status === "active"
        ? `/katakana-speed/session/${data.recentSession.sessionId}`
        : `/katakana-speed/recap/${data.recentSession.sessionId}`) as Route)
    : null;

  async function startSession(input: {
    count?: number;
    manualExercise?: KatakanaSpeedManualExercise;
    mode?: KatakanaSpeedSessionMode;
  }) {
    const mode = input.mode ?? "daily";
    const actionKey = input.manualExercise
      ? `manual:${input.manualExercise}`
      : mode;
    setStartingActionKey(actionKey);
    setClientError(null);

    try {
      const session = await startKatakanaSpeedSessionAction({
        count: input.count ?? defaultCountForMode(mode),
        manualExercise: input.manualExercise,
        mode
      });
      router.push(`/katakana-speed/session/${session.sessionId}` as Route);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile avviare Katakana Speed."
      );
      setStartingActionKey(null);
    }
  }

  return (
    <div className="katakana-speed-page">
      <section className="katakana-speed-hero">
        <SurfaceCard className="katakana-speed-panel" variant="hero">
          <div className="katakana-speed-copy">
            <p className="katakana-speed-eyebrow">Drill locale</p>
            <h1 className="katakana-speed-title">Katakana Speed</h1>
            <p className="katakana-speed-summary">
              Allena il riconoscimento immediato di katakana, piccoli kana e
              combinazioni estese con una sessione focalizzata.
            </p>
          </div>
          <div className="katakana-speed-actions">
            {KATAKANA_SPEED_PRIMARY_ACTIONS.map((action) => (
              <button
                className={
                  action.mode === recommendedMode.mode
                    ? "button button--primary"
                    : "button button--ghost"
                }
                disabled={startingActionKey !== null}
                key={action.mode}
                onClick={() => startSession({ mode: action.mode })}
                type="button"
              >
                {startingActionKey === action.mode ? "Avvio..." : action.label}
              </button>
            ))}
            <span className="katakana-speed-cta-detail">
              Consigliato: {recommendedMode.detail}
            </span>
            {recentHref ? (
              <Link className="button button--ghost" href={recentHref}>
                {data.recentSession?.status === "active"
                  ? "Riprendi"
                  : "Ultimo recap"}
              </Link>
            ) : null}
          </div>
          {clientError ? (
            <p className="kanji-clash-stage__error" role="alert">
              {clientError}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-panel">
          <p className="katakana-speed-eyebrow">Punti deboli</p>
          <p className="katakana-speed-muted">
            Kana o chunk su cui sbagli o rallenti più spesso.
          </p>
          <FocusList items={data.recommendedFocus} />
        </SurfaceCard>
      </section>

      <section aria-label="Esercizio manuale">
        <SurfaceCard className="katakana-speed-panel katakana-speed-panel--wide">
          <div className="katakana-speed-copy">
            <p className="katakana-speed-eyebrow">Esercizio manuale</p>
            <p className="katakana-speed-muted">
              Avvia un solo tipo di drill sul focus consigliato.
            </p>
          </div>
          <div className="katakana-speed-mode-picker">
            {KATAKANA_SPEED_MANUAL_EXERCISE_ACTIONS.map((action) => {
              const actionKey = `manual:${action.manualExercise}`;

              return (
                <button
                  className="katakana-speed-mode-button"
                  disabled={startingActionKey !== null}
                  key={action.manualExercise}
                  onClick={() =>
                    startSession({
                      count: action.count,
                      manualExercise: action.manualExercise,
                      mode: "daily"
                    })
                  }
                  type="button"
                >
                  <span>
                    {startingActionKey === actionKey
                      ? "Avvio..."
                      : action.label}
                  </span>
                  <small>{action.detail}</small>
                </button>
              );
            })}
          </div>
        </SurfaceCard>
      </section>

      <section className="katakana-speed-grid" aria-label="Riepilogo recente">
        <p className="katakana-speed-eyebrow">Il tuo livello</p>
        <div className="stats-grid stats-grid--compact">
          <StatBlock
            detail="Mediana recente"
            label="Velocità"
            value={formatDuration(data.analytics.overview.medianRtMs)}
          />
          <StatBlock
            detail="Risposte oggettive e self-check"
            label="Accuratezza"
            value={formatPercent(data.analytics.overview.accuracyPercent)}
          />
          <StatBlock
            detail="Senza esitazione o lentezza"
            label="Fluide"
            value={formatPercent(data.analytics.overview.fluentCorrectPercent)}
          />
          <StatBlock
            detail="Focus suggerito"
            label="Problema"
            value={data.recommendedFocus[0]?.surface ?? "-"}
          />
        </div>

        <SurfaceCard className="katakana-speed-panel katakana-speed-panel--wide">
          <p className="katakana-speed-eyebrow">Famiglie kana</p>
          <FamilyCards items={data.analytics.familyCards} />
        </SurfaceCard>

        <section
          className="katakana-speed-analytics-grid"
          aria-label="Diagnostica"
        >
          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Top confusioni</p>
            <ConfusionList items={data.analytics.topConfusions} />
          </SurfaceCard>

          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Corrette ma lente</p>
            <SlowList items={data.analytics.topSlowItems} />
          </SurfaceCard>
        </section>

        {data.recentSession && recentHref ? (
          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Ultima sessione</p>
            {data.recentSession.totalAttempts > 0 ? (
              <>
                <p className="katakana-speed-muted">
                  {data.recentSession.totalAttempts} tentativi
                  {data.recentSession.slowCorrectCount > 0
                    ? ` · ${data.recentSession.slowCorrectCount} corretti lenti`
                    : ""}
                  .
                </p>
                <Link className="text-link" href={recentHref}>
                  {data.recentSession.status === "active"
                    ? "Riprendi sessione"
                    : "Apri recap"}
                </Link>
              </>
            ) : (
              <Link className="text-link" href={recentHref}>
                {data.recentSession.status === "active"
                  ? "Riprendi sessione"
                  : "Apri recap"}
              </Link>
            )}
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}

function defaultCountForMode(mode: KatakanaSpeedSessionMode) {
  if (mode === "repair") {
    return 34;
  }
  if (mode === "diagnostic_probe") {
    return 24;
  }
  if (mode === "daily") {
    return 32;
  }
  return 32;
}

function FocusList({
  items
}: {
  items: KatakanaSpeedPageData["recommendedFocus"];
}) {
  if (items.length === 0) {
    return (
      <p className="katakana-speed-muted">Nessun punto debole registrato.</p>
    );
  }

  return (
    <ul className="katakana-speed-focus-list">
      {items.map((item) => (
        <li className="katakana-speed-focus-list__item" key={item.itemId}>
          <span className="katakana-speed-focus-list__surface">
            {item.surface}
          </span>
        </li>
      ))}
    </ul>
  );
}
