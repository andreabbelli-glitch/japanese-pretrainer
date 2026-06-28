import type { Route } from "next";

import { applyFsrsRescheduleAction } from "@/actions/settings";
import type { FsrsReschedulePreview } from "@/features/fsrs-optimizer/server";

import { SurfaceCard } from "../ui/surface-card";
import { ApplyFsrsRescheduleButton } from "./apply-fsrs-reschedule-button";

export type FsrsRescheduleStatus = "applied" | "noop" | "stale";

type FsrsManualReschedulePanelProps = {
  preview: FsrsReschedulePreview;
  returnTo?: Route | null;
  status?: FsrsRescheduleStatus | null;
};

export function FsrsManualReschedulePanel({
  preview,
  returnTo,
  status
}: FsrsManualReschedulePanelProps) {
  const hasAffectedCards = preview.summary.affectedSubjects > 0;
  const maxAbsDelta = Math.max(
    1,
    ...preview.days.map((day) => Math.abs(day.delta))
  );

  return (
    <SurfaceCard className="settings-panel" variant="quiet">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Review</p>
          <h3 className="settings-panel__title">
            Riallineamento calendario FSRS
          </h3>
        </div>
        <p className="settings-panel__body">
          Preview manuale: confronta le date salvate con un replay completo
          usando i parametri FSRS attivi.
        </p>
      </div>

      {status ? <FsrsRescheduleNotice status={status} /> : null}

      <div className="settings-choice-grid settings-choice-grid--compact">
        <MetricCard
          label="Card interessate"
          value={preview.summary.affectedSubjects}
        />
        <MetricCard label="Spostate prima" value={preview.summary.movedEarlier} />
        <MetricCard label="Spostate dopo" value={preview.summary.movedLater} />
        <MetricCard
          label="Delta oggi"
          value={formatSigned(preview.summary.deltaDueToday)}
        />
        <MetricCard
          label="Delta 7 giorni"
          value={formatSigned(preview.summary.delta7Days)}
        />
        <MetricCard
          label="Delta 30 giorni"
          value={formatSigned(preview.summary.delta30Days)}
        />
      </div>

      <div
        aria-label="Impatto giornaliero del riallineamento FSRS"
        className="fsrs-reschedule-chart"
        role="img"
      >
        {preview.days.map((day) => (
          <div key={day.date} className="fsrs-reschedule-chart__row">
            <span className="fsrs-reschedule-chart__date">{day.date}</span>
            <span className="fsrs-reschedule-chart__track" aria-hidden="true">
              <span
                className={
                  day.delta < 0
                    ? "fsrs-reschedule-chart__bar fsrs-reschedule-chart__bar--negative"
                    : "fsrs-reschedule-chart__bar"
                }
                style={{
                  width: `${Math.max(
                    6,
                    (Math.abs(day.delta) / maxAbsDelta) * 100
                  )}%`
                }}
              />
            </span>
            <span className="fsrs-reschedule-chart__value">
              {formatSigned(day.delta)}
            </span>
            <span className="sr-only">
              {day.date}: ora {day.currentCount}, dopo {day.proposedCount},
              delta {formatSigned(day.delta)}.
            </span>
          </div>
        ))}
      </div>

      <form action={applyFsrsRescheduleAction} className="settings-action-form">
        <input
          name="fsrsCacheKeyPart"
          type="hidden"
          value={preview.fsrsCacheKeyPart}
        />
        {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
        <div className="settings-form__footer">
          <ApplyFsrsRescheduleButton disabled={!hasAffectedCards} />
        </div>
      </form>

      {!hasAffectedCards ? (
        <p className="settings-panel__body">Nessuna card da riallineare.</p>
      ) : null}
    </SurfaceCard>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="settings-choice-card">
      <span className="settings-choice-card__title">{label}</span>
      <span className="settings-metric-value">{value}</span>
    </div>
  );
}

function FsrsRescheduleNotice({ status }: { status: FsrsRescheduleStatus }) {
  const message =
    status === "applied"
      ? "Calendario FSRS riallineato."
      : status === "stale"
        ? "Parametri FSRS cambiati: ricarica la preview prima di applicare."
        : "Nessuna card da riallineare.";

  return (
    <p className="settings-notice" role="status">
      {message}
    </p>
  );
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
