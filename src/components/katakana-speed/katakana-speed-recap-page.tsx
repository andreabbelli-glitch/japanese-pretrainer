import type { Route } from "next";
import Link from "next/link";

import type { KatakanaSpeedRecapPageData } from "@/features/katakana-speed/server";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  ConfusionList,
  FamilyCards,
  formatDuration,
  formatPercent,
  SlowList
} from "./katakana-speed-shared";

type KatakanaSpeedRecapPageProps = {
  data: KatakanaSpeedRecapPageData;
};

export function KatakanaSpeedRecapPage({ data }: KatakanaSpeedRecapPageProps) {
  const accuracy =
    data.session.totalAttempts > 0
      ? Math.round(
          (data.session.correctAttempts / data.session.totalAttempts) * 100
        )
      : null;

  return (
    <div className="katakana-speed-recap-page">
      <section className="katakana-speed-hero">
        <SurfaceCard className="katakana-speed-recap-panel" variant="hero">
          <p className="katakana-speed-eyebrow">Recap sessione</p>
          <h1 className="katakana-speed-title">Katakana Speed</h1>
          <p className="katakana-speed-summary">
            Risultati salvati nello storico locale. Usa il focus consigliato per
            scegliere il prossimo drill.
          </p>
          <div className="katakana-speed-actions">
            <Link
              className="button button--primary"
              href={"/katakana-speed" as Route}
            >
              Nuovo drill
            </Link>
          </div>
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Focus consigliato</p>
          {data.session.recommendedFocus.length > 0 ? (
            <ul className="katakana-speed-focus-list">
              {data.session.recommendedFocus.map((item) => (
                <li
                  className="katakana-speed-focus-list__item"
                  key={item.itemId}
                >
                  <span className="katakana-speed-focus-list__surface">
                    {item.surface}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="katakana-speed-muted">
              Nessuna confusione dominante.
            </p>
          )}
        </SurfaceCard>
      </section>

      <section className="stats-grid" aria-label="Metriche sessione">
        <StatBlock
          detail="Risposte corrette"
          label="Accuratezza"
          value={accuracy === null ? "-" : `${accuracy}%`}
        />
        <StatBlock
          detail="Mediana"
          label="Tempo"
          value={formatDuration(data.session.medianRtMs)}
        />
        <StatBlock
          detail="P90"
          label="Picco"
          value={formatDuration(data.session.p90RtMs)}
        />
        <StatBlock
          detail="Corrette ma lente"
          label="Lente"
          value={String(data.session.slowCorrectCount)}
        />
      </section>

      <ModeAwareMetrics analytics={data.analytics} />

      <RanGridRecap metric={data.analytics.modeMetrics.ranItemsPerSecond} />

      <OperationalExerciseSummary attempts={data.attempts} />

      <section
        className="katakana-speed-analytics-grid"
        aria-label="Diagnostica sessione"
      >
        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Top confusioni</p>
          <ConfusionList items={data.analytics.topConfusions} />
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Corrette ma lente</p>
          <SlowList items={data.analytics.topSlowItems} />
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Famiglie kana</p>
          <FamilyCards items={data.analytics.familyCards} />
        </SurfaceCard>
      </section>

      <AttemptLog attempts={data.attempts} />

      {data.exerciseResults.length > 0 ? (
        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Risultati esercizi</p>
          <div className="entry-preview-list">
            {data.exerciseResults.map((result) => (
              <article className="summary-row" key={result.resultId}>
                <span>{formatExerciseLabel(result.metrics)}</span>
                <strong>{formatExerciseMetric(result.metrics)}</strong>
              </article>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function OperationalExerciseSummary({
  attempts
}: {
  attempts: KatakanaSpeedRecapPageData["attempts"];
}) {
  const counts = new Map<string, number>();

  for (const attempt of attempts) {
    const exerciseCode = parseExerciseCode(attempt.features.exerciseCode);
    if (!exerciseCode) {
      continue;
    }

    counts.set(exerciseCode, (counts.get(exerciseCode) ?? 0) + 1);
  }

  const rows = [...counts.entries()]
    .sort(
      ([leftCode, leftCount], [rightCode, rightCount]) =>
        rightCount - leftCount || leftCode.localeCompare(rightCode)
    )
    .slice(0, 8);

  if (rows.length === 0) {
    return null;
  }

  return (
    <SurfaceCard className="katakana-speed-recap-panel">
      <p className="katakana-speed-eyebrow">Tipi di esercizio</p>
      <div className="entry-preview-list">
        {rows.map(([exerciseCode, count]) => (
          <article className="summary-row" key={exerciseCode}>
            <span>{formatExerciseCodeLabel(exerciseCode)}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>
    </SurfaceCard>
  );
}

function ModeAwareMetrics({
  analytics
}: {
  analytics: KatakanaSpeedRecapPageData["analytics"];
}) {
  const metrics = analytics.modeMetrics;
  const statBlocks = [
    metrics.rareAccuracy
      ? {
          detail: `${metrics.rareAccuracy.attempts} ${metrics.rareAccuracy.attempts === 1 ? "tentativo" : "tentativi"}`,
          label: "Precisione rare",
          value: formatPercent(metrics.rareAccuracy.accuracyPercent)
        }
      : null,
    metrics.pseudoTransfer
      ? {
          detail: `${formatDuration(metrics.pseudoTransfer.medianMsPerMora)} / mora`,
          label: "Pseudo-parole",
          value: formatPercent(metrics.pseudoTransfer.transferReadyPercent)
        }
      : null,

    metrics.sentenceFlow
      ? {
          detail: `${metrics.sentenceFlow.attempts} frasi`,
          label: "Frasi",
          value: `${formatDuration(metrics.sentenceFlow.medianMsPerMora)} / mora`
        }
      : null,
    metrics.repeatedReadingGain
      ? {
          detail: metrics.repeatedReadingGain.transferStatus,
          label: "Lettura ripetuta",
          value: `${metrics.repeatedReadingGain.latestGainPercent}%`
        }
      : null,
    metrics.ranItemsPerSecond
      ? {
          detail:
            metrics.ranItemsPerSecond.errors === null
              ? "Griglia"
              : `${metrics.ranItemsPerSecond.errors} errori`,
          label: "Velocità griglia",
          value: `${metrics.ranItemsPerSecond.itemsPerSecond.toFixed(2).replace(".", ",")}/s`
        }
      : null
  ].filter(
    (
      block
    ): block is {
      detail: string;
      label: string;
      value: string;
    } => block !== null
  );

  if (statBlocks.length === 0) {
    return null;
  }

  return (
    <section
      className="stats-grid stats-grid--compact"
      aria-label="Mode metrics"
    >
      {statBlocks.map((block) => (
        <StatBlock
          detail={block.detail}
          key={block.label}
          label={block.label}
          value={block.value}
        />
      ))}
    </section>
  );
}

function RanGridRecap({
  metric
}: {
  metric: KatakanaSpeedRecapPageData["analytics"]["modeMetrics"]["ranItemsPerSecond"];
}) {
  if (!metric) {
    return null;
  }

  const wrongIndexes = new Set(metric.wrongCellIndexes);
  const hasGrid = metric.cellSurfaces.length > 0;

  return (
    <SurfaceCard className="katakana-speed-recap-panel">
      <p className="katakana-speed-eyebrow">Celle segnate</p>
      {hasGrid ? (
        <div
          className="katakana-speed-ran-grid katakana-speed-ran-grid--mini"
          aria-label="RAN Grid recap"
        >
          {metric.cellSurfaces.map((surface, index) => {
            const isWrong = wrongIndexes.has(index);

            return (
              <span
                aria-label={`${surface}${isWrong ? ", errore" : ""}`}
                className={`katakana-speed-ran-cell katakana-speed-ran-cell--mini${
                  isWrong ? " katakana-speed-ran-cell--wrong" : ""
                }`}
                key={`${surface}-${index}`}
              >
                {surface}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="katakana-speed-muted">
          {metric.errors === null
            ? "Nessuna posizione cella salvata."
            : `${metric.errors} errori salvati senza posizioni cella.`}
        </p>
      )}
    </SurfaceCard>
  );
}

function AttemptLog({
  attempts
}: {
  attempts: KatakanaSpeedRecapPageData["attempts"];
}) {
  if (attempts.length === 0) {
    return (
      <SurfaceCard className="katakana-speed-recap-panel">
        <p className="katakana-speed-eyebrow">Risposte registrate</p>
        <p className="katakana-speed-muted">
          Nessuna risposta registrata per questa sessione.
        </p>
      </SurfaceCard>
    );
  }

  const VISIBLE_COUNT = 4;
  const visible = attempts.slice(0, VISIBLE_COUNT);
  const hidden = attempts.slice(VISIBLE_COUNT);

  return (
    <SurfaceCard className="katakana-speed-recap-panel">
      <p className="katakana-speed-eyebrow">Risposte registrate</p>
      <div className="katakana-speed-attempt-log">
        {visible.map((attempt) => (
          <AttemptRow attempt={attempt} key={attempt.createdAt} />
        ))}
      </div>
      {hidden.length > 0 ? (
        <details className="katakana-speed-mode-details">
          <summary>Mostra tutte ({attempts.length})</summary>
          <div className="katakana-speed-attempt-log">
            {hidden.map((attempt) => (
              <AttemptRow attempt={attempt} key={attempt.createdAt} />
            ))}
          </div>
        </details>
      ) : null}
    </SurfaceCard>
  );
}

function AttemptRow({
  attempt
}: {
  attempt: KatakanaSpeedRecapPageData["attempts"][number];
}) {
  return (
    <article className="katakana-speed-attempt-row">
      <span className="jp-inline">{attempt.promptSurface}</span>
      <strong>
        {attempt.isCorrect ? "✓ Corretta" : "✗ Da rivedere"} ·{" "}
        {formatDuration(attempt.responseMs)}
      </strong>
    </article>
  );
}

function formatExerciseLabel(metrics: Readonly<Record<string, unknown>>) {
  if (typeof metrics.itemsPerSecond === "number") {
    return "Griglia";
  }
  if (typeof metrics.improvementRatio === "number") {
    return "Lettura ripetuta";
  }

  return "Aggregate";
}

function formatExerciseMetric(metrics: Readonly<Record<string, unknown>>) {
  if (typeof metrics.itemsPerSecond === "number") {
    return `${metrics.itemsPerSecond.toFixed(2).replace(".", ",")} items/sec`;
  }
  if (typeof metrics.improvementRatio === "number") {
    return `${Math.round(metrics.improvementRatio * 100)}% gain`;
  }
  if (typeof metrics.durationMs === "number") {
    return formatDuration(metrics.durationMs);
  }

  return "-";
}

function parseExerciseCode(value: unknown) {
  return typeof value === "string" && /^E\d{2}$/u.test(value) ? value : null;
}

function formatExerciseCodeLabel(exerciseCode: string) {
  const labels: Readonly<Record<string, string>> = {
    E01: "Diagnosi iniziale",
    E02: "Riconoscimento rapido",
    E03: "Coppie minime",
    E04: "Confusioni",
    E10: "Leggi parole",
    E12: "Pseudo-parole",
    E13: "Griglia",
    E15: "Contrasti di mora",
    E16: "Contrasti ー/ッ",
    E18: "Frasi",
    E20: "Riparazione"
  };

  return labels[exerciseCode] ?? exerciseCode;
}
