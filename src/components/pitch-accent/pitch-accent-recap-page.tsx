import type { PitchAccentRecapPageData } from "@/features/pitch-accent/server/contracts";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatPitchAccentCount,
  formatPitchAccentPercent
} from "./pitch-accent-shared";

type PitchAccentRecapPageProps = {
  data: PitchAccentRecapPageData;
};

export function PitchAccentRecapPage({ data }: PitchAccentRecapPageProps) {
  return (
    <div className="pitch-accent-recap-page" data-testid="pitch-accent-recap">
      <SurfaceCard className="pitch-accent-panel" variant="hero">
        <p className="pitch-accent-eyebrow">Recap</p>
        <h1 className="pitch-accent-title">Pitch Accent</h1>
        <div className="stats-grid stats-grid--compact">
          <StatBlock
            detail="Risposte registrate"
            label="Accuratezza"
            value={formatPitchAccentPercent(
              data.session.correctAttempts,
              data.session.totalAttempts
            )}
          />
          <StatBlock
            detail="Totale"
            label="Tentativi"
            value={formatPitchAccentCount(data.session.totalAttempts)}
          />
          <StatBlock
            detail={data.session.status}
            label="Sessione"
            value={`${data.session.totalAttempts}/${data.session.totalTrials}`}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard className="pitch-accent-panel">
        <p className="pitch-accent-eyebrow">Pattern</p>
        <div className="pitch-accent-recap-grid">
          {Object.entries(data.session.patternStats).map(([pattern, stats]) => (
            <div className="pitch-accent-recap-row" key={pattern}>
              <strong>{pattern}</strong>
              <span>
                {stats.correct}/{stats.total} (
                {formatPitchAccentPercent(stats.correct, stats.total)})
              </span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="pitch-accent-panel">
        <p className="pitch-accent-eyebrow">Tentativi</p>
        <ol className="pitch-accent-attempt-list">
          {data.attempts.map((attempt) => (
            <li
              className="pitch-accent-attempt-row"
              data-testid="pitch-accent-attempt-row"
              key={attempt.trialId}
            >
              <strong>{attempt.kana}</strong>
              <span>{attempt.isCorrect ? "corretto" : "errore"}</span>
              <small>{attempt.responseMs} ms</small>
            </li>
          ))}
        </ol>
      </SurfaceCard>
    </div>
  );
}
