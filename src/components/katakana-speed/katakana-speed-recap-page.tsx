import type { Route } from "next";
import Link from "next/link";

import type { KatakanaSpeedRecapPageData } from "@/features/katakana-speed/server";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

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
          <p className="katakana-speed-eyebrow">Recap persistito</p>
          <h1 className="katakana-speed-title">Katakana Speed</h1>
          <p className="katakana-speed-summary">
            Sessione {data.session.status} con metriche salvate nello storico
            locale.
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
          value={formatMs(data.session.medianRtMs)}
        />
        <StatBlock
          detail="P90"
          label="Picco"
          value={formatMs(data.session.p90RtMs)}
        />
        <StatBlock
          detail="Corrette ma lente"
          label="Slow"
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
          <p className="katakana-speed-eyebrow">Top slow-correct</p>
          <SlowList items={data.analytics.topSlowItems} />
        </SurfaceCard>

        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Family cards</p>
          <FamilyCards items={data.analytics.familyCards} />
        </SurfaceCard>
      </section>

      <SurfaceCard className="katakana-speed-recap-panel">
        <p className="katakana-speed-eyebrow">Attempt log compatto</p>
        {data.attempts.length > 0 ? (
          <div className="katakana-speed-attempt-log">
            {data.attempts.map((attempt) => (
              <article
                className="katakana-speed-attempt-row"
                key={attempt.createdAt}
              >
                <span className="jp-inline">{attempt.promptSurface}</span>
                <strong>
                  {attempt.isCorrect ? "OK" : "Repair"} · {attempt.responseMs}{" "}
                  ms
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="katakana-speed-muted">
            Nessuna risposta registrata per questa sessione.
          </p>
        )}
      </SurfaceCard>

      {data.exerciseResults.length > 0 ? (
        <SurfaceCard className="katakana-speed-recap-panel">
          <p className="katakana-speed-eyebrow">Exercise results</p>
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
      <p className="katakana-speed-eyebrow">Operational mix</p>
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
          detail: `${metrics.rareAccuracy.attempts} attempt`,
          label: "Rare accuracy",
          value: formatPercent(metrics.rareAccuracy.accuracyPercent)
        }
      : null,
    metrics.pseudoTransfer
      ? {
          detail: `${formatMs(metrics.pseudoTransfer.medianMsPerMora)} / mora`,
          label: "Pseudo transfer",
          value: formatPercent(metrics.pseudoTransfer.transferReadyPercent)
        }
      : null,
    metrics.sentenceFlow
      ? {
          detail: `${metrics.sentenceFlow.attempts} frasi`,
          label: "Sentence flow",
          value: `${formatMs(metrics.sentenceFlow.medianMsPerMora)} / mora`
        }
      : null,
    metrics.repeatedReadingGain
      ? {
          detail: metrics.repeatedReadingGain.transferStatus,
          label: "Repeated gain",
          value: `${metrics.repeatedReadingGain.latestGainPercent}%`
        }
      : null,
    metrics.ranItemsPerSecond
      ? {
          detail:
            metrics.ranItemsPerSecond.errors === null
              ? "RAN grid"
              : `${metrics.ranItemsPerSecond.errors} errori`,
          label: "RAN speed",
          value: `${metrics.ranItemsPerSecond.itemsPerSecond.toFixed(2)}/s`
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
      <p className="katakana-speed-eyebrow">RAN cells</p>
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

function FamilyCards({
  items
}: {
  items: KatakanaSpeedRecapPageData["analytics"]["familyCards"];
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
  items: KatakanaSpeedRecapPageData["analytics"]["topConfusions"];
}) {
  if (items.length === 0) {
    return (
      <p className="katakana-speed-muted">Nessuna confusione dominante.</p>
    );
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
  items: KatakanaSpeedRecapPageData["analytics"]["topSlowItems"];
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

function formatMs(value: number | null) {
  return value === null ? "-" : `${value} ms`;
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

function formatFamilyStatus(
  status: KatakanaSpeedRecapPageData["analytics"]["familyCards"][number]["status"]
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

function formatExerciseLabel(metrics: Readonly<Record<string, unknown>>) {
  if (typeof metrics.itemsPerSecond === "number") {
    return "RAN Grid";
  }
  if (typeof metrics.improvementRatio === "number") {
    return "Repeated reading";
  }

  return "Aggregate";
}

function formatExerciseMetric(metrics: Readonly<Record<string, unknown>>) {
  if (typeof metrics.itemsPerSecond === "number") {
    return `${metrics.itemsPerSecond.toFixed(2)} items/sec`;
  }
  if (typeof metrics.improvementRatio === "number") {
    return `${Math.round(metrics.improvementRatio * 100)}% gain`;
  }
  if (typeof metrics.durationMs === "number") {
    return `${metrics.durationMs} ms`;
  }

  return "-";
}

function parseExerciseCode(value: unknown) {
  return typeof value === "string" && /^E\d{2}$/u.test(value) ? value : null;
}

function formatExerciseCodeLabel(exerciseCode: string) {
  const labels: Readonly<Record<string, string>> = {
    E01: "Diagnostic probe",
    E02: "Blink recognition",
    E03: "Minimal pair",
    E04: "Confusion set",
    E05: "Same/different",
    E08: "Loanword builder",
    E09: "Chunk spotting",
    E10: "Word naming",
    E11: "Loanword decoder",
    E12: "Pseudoword sprint",
    E13: "RAN grid",
    E14: "Confusion ladder",
    E15: "Mora trap",
    E16: "Pair race",
    E17: "Variant normalization",
    E18: "Sentence reading",
    E20: "Repair drill",
    E21: "Mixed blitz",
    E22: "No-romaji hard mode"
  };

  return labels[exerciseCode] ?? exerciseCode;
}
