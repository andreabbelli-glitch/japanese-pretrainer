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

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

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
              Allenamento rapido per riconoscere coppie minime e chunk estesi
              prima che diventino un collo di bottiglia nella lettura.
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
                : recommendedMode.label}
            </button>
            <span className="katakana-speed-cta-detail">
              {recommendedMode.detail}
            </span>
            {recentHref ? (
              <Link className="button button--ghost" href={recentHref}>
                {data.recentSession?.status === "active"
                  ? "Riprendi"
                  : "Ultimo recap"}
              </Link>
            ) : null}
          </div>
          <div className="katakana-speed-mode-picker" aria-label="Mode picker">
            {modeGroups.map((group) => (
              <div className="katakana-speed-mode-group" key={group.label}>
                <span className="katakana-speed-mode-group__label">
                  {group.label}
                </span>
                <div className="katakana-speed-mode-group__items">
                  {group.options.map((option) => (
                    <button
                      className="katakana-speed-mode-button"
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
          {clientError ? (
            <p className="kanji-clash-stage__error" role="alert">
              {clientError}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-panel">
          <p className="katakana-speed-eyebrow">Weak spots</p>
          <FocusList items={data.recommendedFocus} />
        </SurfaceCard>
      </section>

      <section className="katakana-speed-grid" aria-label="Riepilogo recente">
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
            label="Fluent"
            value={formatPercent(data.analytics.overview.fluentCorrectPercent)}
          />
          <StatBlock
            detail="Mediana recente"
            label="Tempo"
            value={formatMs(data.analytics.overview.medianRtMs)}
          />
        </div>

        <section
          className="katakana-speed-analytics-grid"
          aria-label="Metriche Katakana Speed"
        >
          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Family progress</p>
            <FamilyCards items={data.analytics.familyCards} />
          </SurfaceCard>

          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Top confusioni</p>
            <ConfusionList items={data.analytics.topConfusions} />
          </SurfaceCard>

          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Top slow-correct</p>
            <SlowList items={data.analytics.topSlowItems} />
          </SurfaceCard>
        </section>

        <SurfaceCard className="katakana-speed-panel">
          <p className="katakana-speed-eyebrow">Recent recap</p>
          {data.recentSession ? (
            <>
              <p className="katakana-speed-muted">
                {data.recentSession.totalAttempts} tentativi,{" "}
                {data.recentSession.slowCorrectCount} corretti lenti.
              </p>
              {recentHref ? (
                <Link className="text-link" href={recentHref}>
                  Apri dettagli
                </Link>
              ) : null}
            </>
          ) : (
            <p className="katakana-speed-muted">
              Nessuna sessione salvata. Il primo drill crea subito lo storico
              locale.
            </p>
          )}
        </SurfaceCard>
      </section>
    </div>
  );
}

const modeGroups: readonly {
  readonly label: string;
  readonly options: readonly {
    readonly detail: string;
    readonly label: string;
    readonly mode: KatakanaSpeedSessionMode;
  }[];
}[] = [
  {
    label: "Baseline",
    options: [
      {
        detail: "Probe",
        label: "Diag",
        mode: "diagnostic_probe"
      },
      {
        detail: "Tier C cap",
        label: "Rare",
        mode: "rare_combo"
      },
      {
        detail: "5x5",
        label: "RAN",
        mode: "ran_grid"
      }
    ]
  },
  {
    label: "Transfer",
    options: [
      {
        detail: "Pseudo",
        label: "Pseudo",
        mode: "pseudoword_transfer"
      },
      {
        detail: "Loanwords",
        label: "Decode",
        mode: "loanword_decoder"
      },
      {
        detail: "Frasi",
        label: "Sprint",
        mode: "sentence_sprint"
      },
      {
        detail: "3 passaggi",
        label: "Repeated",
        mode: "repeated_reading"
      }
    ]
  },
  {
    label: "Repair",
    options: [
      {
        detail: "ー / ッ",
        label: "Traps",
        mode: "mora_trap"
      },
      {
        detail: "Chunk",
        label: "Spot",
        mode: "chunk_spotting"
      },
      {
        detail: "Tiles",
        label: "Build",
        mode: "tile_builder"
      },
      {
        detail: "Vertical",
        label: "Ladder",
        mode: "confusion_ladder"
      },
      {
        detail: "Grafie",
        label: "Variants",
        mode: "variant_normalization"
      }
    ]
  }
];

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

function FamilyCards({
  items
}: {
  items: KatakanaSpeedPageData["analytics"]["familyCards"];
}) {
  return (
    <div className="katakana-speed-family-grid">
      {items.map((item) => (
        <article className="katakana-speed-family-card" key={item.family}>
          <div className="katakana-speed-family-card__top">
            <strong>{item.label}</strong>
            <span
              className={`katakana-speed-status katakana-speed-status--${item.status}`}
            >
              {formatFamilyStatus(item.status)}
            </span>
          </div>
          <p className="katakana-speed-family-card__metric">
            {formatPercent(item.accuracyPercent)} · {formatMs(item.medianRtMs)}
          </p>
          <p className="katakana-speed-family-card__focus">
            {item.focusSurfaces.length > 0
              ? item.focusSurfaces.join(" · ")
              : "-"}
          </p>
        </article>
      ))}
    </div>
  );
}

function ConfusionList({
  items
}: {
  items: KatakanaSpeedPageData["analytics"]["topConfusions"];
}) {
  if (items.length === 0) {
    return <p className="katakana-speed-muted">Nessuna confusione recente.</p>;
  }

  return (
    <div className="katakana-speed-diagnostic-list">
      {items.map((item) => (
        <article
          className="katakana-speed-diagnostic-row"
          key={`${item.expectedSurface}-${item.observedSurface}`}
        >
          <span className="jp-inline">
            {item.expectedSurface} → {item.observedSurface}
          </span>
          <strong>
            {item.count} · {item.avgRtMs} ms
          </strong>
        </article>
      ))}
    </div>
  );
}

function SlowList({
  items
}: {
  items: KatakanaSpeedPageData["analytics"]["topSlowItems"];
}) {
  if (items.length === 0) {
    return <p className="katakana-speed-muted">Nessuna lentezza dominante.</p>;
  }

  return (
    <div className="katakana-speed-diagnostic-list">
      {items.map((item) => (
        <article className="katakana-speed-diagnostic-row" key={item.itemId}>
          <span className="jp-inline">{item.surface}</span>
          <strong>
            {item.count} · {item.medianRtMs} ms
          </strong>
        </article>
      ))}
    </div>
  );
}

function formatFamilyStatus(
  status: KatakanaSpeedPageData["analytics"]["familyCards"][number]["status"]
) {
  if (status === "repair") {
    return "Repair";
  }
  if (status === "watch") {
    return "Watch";
  }
  if (status === "stable") {
    return "Stable";
  }

  return "New";
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

function formatMs(value: number | null) {
  return value === null ? "-" : `${value} ms`;
}
