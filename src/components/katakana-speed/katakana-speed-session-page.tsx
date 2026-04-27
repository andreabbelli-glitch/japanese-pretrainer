"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  abandonKatakanaSpeedSessionAction,
  completeKatakanaSpeedSessionAction
} from "@/actions/katakana-speed";
import { getKatakanaSpeedItemById } from "@/features/katakana-speed/model/catalog";
import { formatKatakanaSpeedReading } from "@/features/katakana-speed/model/readings";
import type { KatakanaSpeedSessionPageData } from "@/features/katakana-speed/server";
import type { KatakanaSpeedTrialPlan } from "@/features/katakana-speed/types";
import { cx } from "@/lib/classnames";

import { SurfaceCard } from "../ui/surface-card";
import {
  formatKatakanaSpeedTarget,
  formatSelfRatingLabel,
  getKatakanaSpeedTrialCopy
} from "./katakana-speed-copy";
import { formatDuration } from "./katakana-speed-shared";
import { useKatakanaSpeedSessionController } from "./use-katakana-speed-session-controller";

type KatakanaSpeedSessionPageProps = {
  data: KatakanaSpeedSessionPageData;
};

export function KatakanaSpeedSessionPage({
  data
}: KatakanaSpeedSessionPageProps) {
  const router = useRouter();
  const controller = useKatakanaSpeedSessionController(data);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [readingVisibility, setReadingVisibility] = useState<{
    readonly show: boolean;
    readonly trialKey: string | null;
  }>({ show: false, trialKey: null });
  const finalizingRef = useRef(false);
  const recapHref = `/katakana-speed/recap/${data.sessionId}` as Route;
  const currentTrial = controller.currentTrial;
  const repeatedPass =
    controller.repeatedReadingState?.trials[
      controller.repeatedReadingState.currentPassIndex
    ] ?? null;
  const visibleTrialKey =
    repeatedPass?.trialId ?? currentTrial?.trialId ?? null;
  const showReadings =
    (controller.feedback !== null || controller.ranCanMarkErrors) &&
    readingVisibility.trialKey === visibleTrialKey &&
    readingVisibility.show;
  const showFeedbackReading = controller.feedback !== null;

  useEffect(() => {
    if (!controller.completed || finalizingRef.current) {
      return;
    }

    finalizingRef.current = true;
    void completeKatakanaSpeedSessionAction({ sessionId: data.sessionId })
      .then(() => router.push(recapHref))
      .catch((error) => {
        setClientError(
          error instanceof Error
            ? error.message
            : "Impossibile completare la sessione."
        );
        finalizingRef.current = false;
      });
  }, [controller.completed, data.sessionId, recapHref, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.key !== " " ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.target instanceof HTMLElement) {
        event.target.blur();
      }
      if (!controller.feedback && !controller.ranCanMarkErrors) {
        return;
      }
      setReadingVisibility((current) => ({
        show: current.trialKey === visibleTrialKey ? !current.show : true,
        trialKey: visibleTrialKey
      }));
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [controller.feedback, controller.ranCanMarkErrors, visibleTrialKey]);

  async function abandonSession() {
    setIsFinalizing(true);
    setClientError(null);

    try {
      await abandonKatakanaSpeedSessionAction({ sessionId: data.sessionId });
      router.push(recapHref);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare l'abbandono."
      );
      setIsFinalizing(false);
    }
  }

  if (data.status !== "active") {
    return (
      <div className="katakana-speed-session-page">
        <SurfaceCard className="katakana-speed-stage">
          <p className="katakana-speed-eyebrow">Sessione chiusa</p>
          <h1 className="katakana-speed-title">Katakana Speed</h1>
          <p className="katakana-speed-summary">
            Questa sessione è già stata finalizzata.
          </p>
          <Link className="button button--primary" href={recapHref}>
            Apri recap
          </Link>
        </SurfaceCard>
      </div>
    );
  }

  const currentItem = currentTrial
    ? getKatakanaSpeedItemById(currentTrial.itemId)
    : null;
  const repeatedPassLabel = controller.isRepeatedReadingTrial
    ? formatRepeatedPassLabel(
        controller.repeatedReadingState?.currentPassIndex ?? 0
      )
    : null;
  const trialCopy = currentTrial
    ? getKatakanaSpeedTrialCopy(currentTrial, repeatedPassLabel)
    : null;
  const repeatedPassItem = repeatedPass
    ? getKatakanaSpeedItemById(repeatedPass.itemId)
    : null;
  const visiblePrompt = controller.isRepeatedReadingTrial
    ? repeatedPass?.promptSurface
    : controller.isRanGridTrial
      ? null
      : currentTrial?.promptSurface;
  const readingHint = controller.isRepeatedReadingTrial
    ? formatKatakanaSpeedReading(
        repeatedPassItem ?? repeatedPass?.promptSurface
      )
    : formatKatakanaSpeedReading(currentItem ?? visiblePrompt);
  const promptClassName = cx(
    "katakana-speed-prompt",
    (currentTrial?.mode === "sentence_sprint" ||
      currentTrial?.mode === "repeated_reading_pass") &&
      "katakana-speed-prompt--sentence"
  );

  return (
    <div className="katakana-speed-session-page">
      <div className="katakana-speed-session-layout">
        <SurfaceCard className="katakana-speed-stage" variant="hero">
          <div className="katakana-speed-session-top">
            <p className="katakana-speed-eyebrow">Katakana Speed</p>
            <span className="katakana-speed-muted">
              {Math.min(controller.currentIndex + 1, controller.totalTrials)} /{" "}
              {controller.totalTrials}
            </span>
            <div
              aria-label={`${controller.progressPercent}% completato`}
              className="katakana-speed-progress"
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={controller.progressPercent}
            >
              <span
                className="katakana-speed-progress__bar"
                style={{ width: `${controller.progressPercent}%` }}
              />
            </div>
          </div>

          {currentTrial ? (
            <>
              <div className="katakana-speed-stage__meta">
                <span className="badge katakana-speed-meta-badge">
                  <span className="katakana-speed-meta-badge__label">
                    Esercizio
                  </span>
                  {trialCopy?.label}
                </span>
                <span className="badge katakana-speed-meta-badge">
                  <span className="katakana-speed-meta-badge__label">
                    Tempo
                  </span>
                  {controller.isSelfCheckTrial
                    ? formatTimerLabel(controller.timerState.elapsedMs)
                    : formatKatakanaSpeedTarget(currentTrial.targetRtMs)}
                </span>
              </div>
              {trialCopy ? (
                <div className="katakana-speed-task-copy">
                  <p>{trialCopy.instruction}</p>
                </div>
              ) : null}
              {visiblePrompt ? (
                <>
                  <p className={promptClassName}>{visiblePrompt}</p>
                  <ReadingHint
                    label="Lettura"
                    value={
                      showReadings || showFeedbackReading ? readingHint : null
                    }
                  />
                </>
              ) : null}

              {controller.isRepeatedReadingTrial ? (
                <RepeatedReadingControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                />
              ) : controller.isRanGridTrial ? (
                <RanGridControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                  showReadings={showReadings}
                />
              ) : controller.isSelfCheckTrial ? (
                <SelfCheckControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                  trial={currentTrial}
                />
              ) : (
                <ChoiceControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                  showReadings={showReadings}
                  trial={currentTrial}
                />
              )}
            </>
          ) : (
            <div className="katakana-speed-copy">
              <h1 className="katakana-speed-title">Sessione completata</h1>
              <p className="katakana-speed-summary">
                Sto salvando il recap persistito.
              </p>
            </div>
          )}

          <FeedbackPanel
            clientError={clientError ?? controller.clientError}
            currentTrial={currentTrial}
            feedback={controller.feedback}
            showReadings={showReadings}
            isFinalizing={isFinalizing}
            awaitingContinue={
              controller.awaitingContinue &&
              !controller.isSelfCheckTrial &&
              !controller.isRepeatedReadingTrial &&
              !controller.isRanGridTrial
            }
            isSubmitting={controller.isSubmitting || isFinalizing}
            onContinue={controller.handleContinue}
          />
        </SurfaceCard>

        <aside className="katakana-speed-session-aside">
          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Controlli</p>
            <p className="katakana-speed-muted">
              {trialCopy?.controls ??
                "Rispondi dalla tastiera o tocca una scelta."}
            </p>
            <label className="katakana-speed-reading-toggle">
              <input
                checked={showReadings}
                disabled={!controller.feedback && !controller.ranCanMarkErrors}
                onChange={(event) => {
                  if (!controller.feedback && !controller.ranCanMarkErrors) {
                    return;
                  }
                  setReadingVisibility({
                    show: event.target.checked,
                    trialKey: visibleTrialKey
                  });
                  event.currentTarget.blur();
                }}
                type="checkbox"
              />
              <span>
                <strong>Mostra lettura</strong>
                <small>Dopo risposta o stop, per controllare il reading.</small>
              </span>
            </label>
            <button
              className="button button--ghost"
              disabled={isFinalizing}
              onClick={abandonSession}
              type="button"
            >
              Abbandona e salva recap
            </button>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}

function ChoiceControls({
  controller,
  disabled,
  showReadings,
  trial
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
  showReadings: boolean;
  trial: KatakanaSpeedTrialPlan;
}) {
  return (
    <div className="katakana-speed-options">
      {controller.options.map((option, index) => (
        <button
          className={cx(
            "katakana-speed-option",
            controller.feedback?.trialId === trial.trialId &&
              controller.feedback.selectedSurface === option.surface &&
              (controller.feedback.status === "incorrect"
                ? "katakana-speed-option--incorrect"
                : "katakana-speed-option--correct")
          )}
          disabled={disabled || controller.awaitingContinue}
          key={option.itemId}
          onClick={() =>
            controller.handleChooseOption(option.itemId, "pointer")
          }
          onTouchEnd={(event) => {
            event.preventDefault();
            controller.handleChooseOption(option.itemId, "touch");
          }}
          type="button"
        >
          <span className="katakana-speed-option__key">{index + 1}</span>
          <span className="katakana-speed-option__surface">
            {option.surface}
          </span>
          <ReadingHint value={showReadings ? option.readingHint : null} />
        </button>
      ))}
    </div>
  );
}

function SelfCheckControls({
  controller,
  disabled,
  trial
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
  trial: KatakanaSpeedTrialPlan;
}) {
  return (
    <div className="katakana-speed-selfcheck">
      <div className="katakana-speed-timer" role="timer">
        <span className="katakana-speed-timer__value">
          {formatTimerLabel(controller.timerState.elapsedMs)}
        </span>
        <span className="katakana-speed-timer__hint">
          Si ferma quando scegli 1, 2 o 3.
        </span>
      </div>

      <div className="katakana-speed-options katakana-speed-options--rating">
        {controller.selfCheckRatings.map((rating) => (
          <button
            className={cx(
              "katakana-speed-option",
              "katakana-speed-option--rating",
              controller.feedback?.trialId === trial.trialId &&
                controller.feedback.selfRating === rating.value &&
                (controller.feedback.status === "incorrect"
                  ? "katakana-speed-option--incorrect"
                  : "katakana-speed-option--correct")
            )}
            disabled={disabled || controller.awaitingContinue}
            key={rating.value}
            onClick={() => controller.handleSubmitSelfCheck(rating.value)}
            type="button"
          >
            <span className="katakana-speed-option__key">{rating.key}</span>
            <span className="katakana-speed-option__label">{rating.label}</span>
            <span className="katakana-speed-option__hint">
              {rating.description}
            </span>
          </button>
        ))}
      </div>

      <button
        className="button button--ghost"
        disabled={!controller.awaitingContinue || disabled}
        onClick={controller.handleContinue}
        type="button"
      >
        Continua
      </button>
    </div>
  );
}

function RepeatedReadingControls({
  controller,
  disabled
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
}) {
  const state = controller.repeatedReadingState;
  const timerRunning = controller.timerState.phase === "running";
  const canAdvance =
    controller.timerState.phase === "stopped" && !controller.awaitingContinue;

  if (!state) {
    return null;
  }

  return (
    <div className="katakana-speed-selfcheck">
      <div className="katakana-speed-pass-list" aria-label="Passaggi">
        {state.trials.map((trial, index) => (
          <span
            className={cx(
              "katakana-speed-pass-chip",
              index === state.currentPassIndex &&
                "katakana-speed-pass-chip--active"
            )}
            key={trial.trialId}
          >
            {formatRepeatedPassLabel(index)}
          </span>
        ))}
      </div>

      <div className="katakana-speed-timer" role="timer">
        <span className="katakana-speed-timer__value">
          {formatTimerLabel(controller.timerState.elapsedMs)}
        </span>
        <button
          className="button button--primary"
          disabled={disabled || controller.awaitingContinue || !timerRunning}
          onClick={controller.handleToggleTimer}
          type="button"
        >
          {timerRunning ? "Ferma tempo" : "Timer fermo"}
        </button>
      </div>

      <button
        className="button button--ghost"
        disabled={disabled || (!canAdvance && !controller.awaitingContinue)}
        onClick={
          controller.awaitingContinue
            ? controller.handleContinue
            : controller.handleContinueRepeatedReading
        }
        type="button"
      >
        {controller.awaitingContinue
          ? "Continua"
          : state.currentPassIndex + 1 >= state.passCount
            ? "Salva blocco"
            : "Prossima lettura"}
      </button>
    </div>
  );
}

function RanGridControls({
  controller,
  disabled,
  showReadings
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
  showReadings: boolean;
}) {
  const timerRunning = controller.timerState.phase === "running";
  const canSubmit =
    controller.timerState.phase === "stopped" && !controller.awaitingContinue;

  return (
    <div className="katakana-speed-ran-workspace">
      <div className="katakana-speed-ran-grid" aria-label="RAN Grid">
        {controller.ranGridCells.map((cell, index) => {
          const isWrong = controller.ranWrongCellIndexes.includes(index);
          const row = Math.floor(index / 5) + 1;
          const column = (index % 5) + 1;

          return (
            <button
              aria-label={`Riga ${row}, colonna ${column}, ${cell.surface}${
                showReadings && cell.readingHint
                  ? `, lettura ${cell.readingHint}`
                  : ""
              }${isWrong ? ", segnato come errore" : ""}`}
              aria-pressed={isWrong}
              className={`katakana-speed-ran-cell${
                isWrong ? " katakana-speed-ran-cell--wrong" : ""
              }`}
              disabled={disabled || !controller.ranCanMarkErrors}
              key={`${cell.itemId}-${index}`}
              onClick={() => controller.handleToggleRanWrongCell(index)}
              type="button"
            >
              <span>{cell.surface}</span>
              <ReadingHint value={showReadings ? cell.readingHint : null} />
            </button>
          );
        })}
      </div>

      <div className="katakana-speed-ran-controls">
        <div className="katakana-speed-timer" role="timer">
          <span className="katakana-speed-timer__value">
            {formatTimerLabel(controller.timerState.elapsedMs)}
          </span>
          <button
            className="button button--primary"
            disabled={disabled || controller.awaitingContinue || !timerRunning}
            onClick={controller.handleToggleTimer}
            type="button"
          >
            {timerRunning ? "Ferma tempo" : "Timer fermo"}
          </button>
        </div>

        <p className="katakana-speed-ran-errors" aria-live="polite">
          <span>
            {controller.ranCanMarkErrors
              ? "Marca le celle sbagliate"
              : "Dopo Stop: marca errori"}
          </span>
          <strong>Errori: {controller.ranErrorCount}</strong>
        </p>

        <button
          className="button button--ghost"
          disabled={disabled || (!canSubmit && !controller.awaitingContinue)}
          onClick={
            controller.awaitingContinue
              ? controller.handleContinue
              : controller.handleSubmitRanGrid
          }
          type="button"
        >
          {controller.awaitingContinue ? "Continua" : "Salva griglia"}
        </button>
      </div>
    </div>
  );
}

function FeedbackPanel({
  clientError,
  currentTrial,
  feedback,
  showReadings,
  isFinalizing,
  awaitingContinue,
  isSubmitting,
  onContinue
}: {
  clientError: string | null;
  currentTrial: KatakanaSpeedTrialPlan | null;
  feedback: ReturnType<typeof useKatakanaSpeedSessionController>["feedback"];
  showReadings: boolean;
  isFinalizing: boolean;
  awaitingContinue: boolean;
  isSubmitting: boolean;
  onContinue: () => void;
}) {
  if (clientError) {
    return (
      <div
        className="katakana-speed-feedback katakana-speed-feedback--incorrect"
        role="alert"
      >
        <p className="katakana-speed-feedback__title">Errore</p>
        <p className="katakana-speed-feedback__body">{clientError}</p>
      </div>
    );
  }

  if (isFinalizing) {
    return (
      <div className="katakana-speed-feedback" role="status">
        <p className="katakana-speed-feedback__title">Salvataggio</p>
        <p className="katakana-speed-feedback__body">Recap in aggiornamento.</p>
      </div>
    );
  }

  if (!feedback) {
    return null;
  }

  const meaning = currentTrial
    ? getKatakanaSpeedItemById(currentTrial.itemId)?.meaningIt
    : null;
  const expectedReading = showReadings
    ? formatKatakanaSpeedReading(feedback.expectedSurface)
    : null;

  return (
    <div
      className={cx(
        "katakana-speed-feedback",
        `katakana-speed-feedback--${feedback.status}`
      )}
      aria-live="polite"
    >
      <p className="katakana-speed-feedback__title">
        {feedback.status === "incorrect"
          ? "Da rivedere"
          : feedback.status === "correct-slow"
            ? "Corretta ma lenta"
            : "Corretto"}
      </p>
      <p className="katakana-speed-feedback__body">
        {feedback.selfRating
          ? `${formatSelfRatingLabel(feedback.selfRating)} in ${formatDuration(feedback.responseMs)}`
          : `${feedback.selectedSurface} / ${feedback.expectedSurface} in ${formatDuration(feedback.responseMs)}`}
        {feedback.status === "correct-slow" && currentTrial?.targetRtMs
          ? ` · obiettivo: ${(currentTrial.targetRtMs / 1000).toFixed(1).replace(".", ",")} s`
          : ""}
        {meaning ? ` · ${meaning}` : ""}
      </p>
      <ReadingHint label="Lettura attesa" value={expectedReading} />
      {awaitingContinue ? (
        <button
          className="button button--ghost katakana-speed-continue-after-error"
          disabled={isSubmitting}
          onClick={onContinue}
          type="button"
        >
          Rivedi e continua
        </button>
      ) : null}
    </div>
  );
}

function ReadingHint({
  label = "Romaji",
  value
}: {
  label?: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <span className="katakana-speed-reading-hint">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function formatRepeatedPassLabel(index: number) {
  if (index === 0) {
    return "Prima";
  }
  if (index === 1) {
    return "Ripeti";
  }

  return "Transfer";
}

function formatTimerLabel(value: number) {
  return `${(value / 1000).toFixed(1)} s`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
