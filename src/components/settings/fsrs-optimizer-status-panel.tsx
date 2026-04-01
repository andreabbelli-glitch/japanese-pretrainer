import { SurfaceCard } from "../ui/surface-card";
import type { FsrsOptimizerStatus } from "@/lib/fsrs-optimizer";

type FsrsOptimizerStatusPanelProps = {
  status: FsrsOptimizerStatus;
};

export function FsrsOptimizerStatusPanel({
  status
}: FsrsOptimizerStatusPanelProps) {
  return (
    <SurfaceCard className="settings-panel" variant="quiet">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Review</p>
          <h3 className="settings-panel__title">FSRS optimizer</h3>
        </div>
        <p className="settings-panel__body">
          Stato read-only del training automatico esterno usato per adattare la
          review ai tuoi log reali.
        </p>
      </div>
      <div className="stack-list stack-list--tight">
        <p className="settings-panel__body">
          Stato optimizer:{" "}
          <strong>{status.config.enabled ? "Attivo" : "Disattivato"}</strong>
        </p>
        <p className="settings-panel__body">
          {status.config.enabled
            ? "Strategia attiva: preset per tipo card (`recognition`, `concept`)."
            : "Optimizer automatico disattivato: il job schedulato non parte, ma `pnpm fsrs:optimize` puo comunque forzare un retrain."}
        </p>
        <p className="settings-panel__body">
          Desired retention:{" "}
          <strong>{formatRetention(status.config.desiredRetention)}</strong>
        </p>
        <p className="settings-panel__body">
          Ultimo training riuscito:{" "}
          <strong>
            {formatDateTime(status.state.lastSuccessfulTrainingAt)}
          </strong>
        </p>
        <p className="settings-panel__body">
          Review nuove accumulate:{" "}
          <strong>{status.newEligibleReviews}</strong>
          {` / ${status.config.minNewReviews} minime`}
        </p>
        <p className="settings-panel__body">
          Ultimo check:{" "}
          <strong>{formatDateTime(status.state.lastCheckAt)}</strong>
        </p>
      </div>
      <div className="settings-choice-grid settings-choice-grid--compact">
        {(["recognition", "concept"] as const).map((presetKey) => {
          const preset = status.presets[presetKey];

          return (
            <div key={presetKey} className="settings-choice-card">
              <span className="settings-choice-card__title">
                {presetKey === "recognition"
                  ? "Preset recognition"
                  : "Preset concept"}
              </span>
              <span className="settings-choice-card__body">
                {preset.usesOptimizedParameters
                  ? `Parametri ottimizzati attivi. Training su ${preset.trainingReviewCount} review. Ultimo aggiornamento ${formatDateTime(preset.trainedAt)}.`
                  : "Nessun training valido salvato: la review usa il fallback di default."}
              </span>
            </div>
          );
        })}
      </div>
      {status.state.lastTrainingError ? (
        <p className="settings-notice" role="status">
          Ultimo errore training: {status.state.lastTrainingError}
        </p>
      ) : null}
    </SurfaceCard>
  );
}

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatDateTime(value: string | null) {
  if (!value) {
    return "Mai";
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Mai"
    : dateTimeFormatter.format(parsed);
}

function formatRetention(value: number) {
  return `${Math.round(value * 100)}%`;
}
