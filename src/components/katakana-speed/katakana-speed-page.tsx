"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { startKatakanaSpeedSessionAction } from "@/actions/katakana-speed";
import type {
  KatakanaSpeedPageData,
  KatakanaSpeedSessionMode
} from "@/features/katakana-speed/server";
import { cx } from "@/lib/classnames";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import { KATAKANA_SPEED_MODE_GROUPS } from "./katakana-speed-copy";
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
  const [startingMode, setStartingMode] =
    useState<KatakanaSpeedSessionMode | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const recommendedMode = data.analytics.recommendedMode;
  const recentHref: Route | null = data.recentSession
    ? ((data.recentSession.status === "active"
        ? `/katakana-speed/session/${data.recentSession.sessionId}`
        : `/katakana-speed/recap/${data.recentSession.sessionId}`) as Route)
    : null;

  async function startSession(mode: KatakanaSpeedSessionMode = "daily") {
    setStartingMode(mode);
    setClientError(null);

    try {
      const session = await startKatakanaSpeedSessionAction({
        count: 12,
        mode
      });
      router.push(`/katakana-speed/session/${session.sessionId}` as Route);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile avviare Katakana Speed."
      );
      setStartingMode(null);
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
              Allena la lettura del katakana con esercizi brevi: scegli, leggi a
              tempo, ricostruisci parole e correggi le confusioni più lente.
            </p>
          </div>
          <div className="katakana-speed-actions">
            <button
              className="button button--primary"
              disabled={startingMode !== null}
              onClick={() => startSession(recommendedMode.mode)}
              type="button"
            >
              {startingMode === recommendedMode.mode
                ? "Avvio..."
                : "Inizia drill"}
            </button>
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
          <details className="katakana-speed-mode-details">
            <summary>Scegli esercizio</summary>
            <div
              className="katakana-speed-mode-picker"
              aria-label="Selettore esercizi"
            >
              {KATAKANA_SPEED_MODE_GROUPS.map((group) => (
                <div className="katakana-speed-mode-group" key={group.label}>
                  <span className="katakana-speed-mode-group__label">
                    {group.label}
                  </span>
                  <div className="katakana-speed-mode-group__items">
                    {group.options.map((option) => (
                      <button
                        className={cx(
                          "katakana-speed-mode-button",
                          option.mode === recommendedMode.mode &&
                            "katakana-speed-mode-button--recommended"
                        )}
                        disabled={startingMode !== null}
                        key={option.mode}
                        onClick={() => startSession(option.mode)}
                        type="button"
                      >
                        <span>{option.label}</span>
                        <small>{option.detail}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
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

      <section className="katakana-speed-grid" aria-label="Riepilogo recente">
        <p className="katakana-speed-eyebrow">Il tuo livello</p>
        <div className="stats-grid stats-grid--compact">
          <StatBlock
            detail="Catalogo statico"
            label="Kana/chunk"
            value={String(data.catalogSize)}
          />
          <StatBlock
            detail="Storico recente"
            label="Accuratezza"
            value={formatPercent(data.analytics.overview.accuracyPercent)}
          />
          <StatBlock
            detail="Corrette sotto soglia"
            label="Fluide"
            value={formatPercent(data.analytics.overview.fluentCorrectPercent)}
          />
          <StatBlock
            detail="Mediana recente"
            label="Tempo mediano"
            value={formatDuration(data.analytics.overview.medianRtMs)}
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
