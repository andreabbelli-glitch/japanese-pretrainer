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
import type { KatakanaSpeedSessionPageData } from "@/features/katakana-speed/server";
import type { KatakanaSpeedTrialPlan } from "@/features/katakana-speed/types";
import { cx } from "@/lib/classnames";

import { SurfaceCard } from "../ui/surface-card";
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
  const finalizingRef = useRef(false);
  const recapHref = `/katakana-speed/recap/${data.sessionId}` as Route;

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
            Questa sessione e gia stata finalizzata.
          </p>
          <Link className="button button--primary" href={recapHref}>
            Apri recap
          </Link>
        </SurfaceCard>
      </div>
    );
  }

  const currentTrial = controller.currentTrial;
  const repeatedPass =
    controller.repeatedReadingState?.trials[
      controller.repeatedReadingState.currentPassIndex
    ] ?? null;
  const visiblePrompt = controller.isRepeatedReadingTrial
    ? repeatedPass?.promptSurface
    : controller.isRanGridTrial
      ? null
      : currentTrial?.promptSurface;
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
                <span className="badge">{currentTrial.mode}</span>
                <span className="badge">
                  {controller.isSelfCheckTrial
                    ? formatTimerLabel(controller.timerState.elapsedMs)
                    : `${currentTrial.targetRtMs} ms`}
                </span>
              </div>
              {visiblePrompt ? (
                <p className={promptClassName}>{visiblePrompt}</p>
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
                />
              ) : controller.isTileBuilderTrial ? (
                <TileBuilderControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                />
              ) : controller.isSegmentSelectTrial ? (
                <SegmentSelectControls
                  controller={controller}
                  disabled={controller.isSubmitting || isFinalizing}
                  trial={currentTrial}
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
            isFinalizing={isFinalizing}
          />
        </SurfaceCard>

        <aside className="katakana-speed-session-aside">
          <SurfaceCard className="katakana-speed-panel">
            <p className="katakana-speed-eyebrow">Controlli</p>
            <p className="katakana-speed-muted">
              {controller.isRanGridTrial || controller.isRepeatedReadingTrial
                ? "Space avvia o ferma il timer. Enter avanza o salva il blocco."
                : controller.isSelfCheckTrial
                  ? "Space avvia o ferma il timer. 1-3 salva il rating, Enter continua."
                  : "Rispondi con 1-4 dalla tastiera o tocca una scelta."}
            </p>
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
  trial
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
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
          disabled={disabled}
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
        </button>
      ))}
    </div>
  );
}

function SegmentSelectControls({
  controller,
  disabled,
  trial
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
  trial: KatakanaSpeedTrialPlan;
}) {
  return (
    <div className="katakana-speed-segment-options">
      {controller.options.map((option) => (
        <button
          className={cx(
            "katakana-speed-segment-option",
            controller.feedback?.trialId === trial.trialId &&
              controller.feedback.selectedSurface === option.surface &&
              (controller.feedback.status === "incorrect"
                ? "katakana-speed-option--incorrect"
                : "katakana-speed-option--correct")
          )}
          disabled={disabled}
          key={option.itemId}
          onClick={() =>
            controller.handleChooseOption(option.itemId, "pointer")
          }
          type="button"
        >
          {option.surface}
        </button>
      ))}
    </div>
  );
}

function TileBuilderControls({
  controller,
  disabled
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
}) {
  const state = controller.tileBuilderState;

  if (!state) {
    return null;
  }

  return (
    <div className="katakana-speed-tile-builder">
      <div className="katakana-speed-tile-answer" aria-live="polite">
        {state.answerSurface || " "}
      </div>
      <div className="katakana-speed-tile-grid">
        {state.tiles.map((tile) => (
          <button
            className={cx(
              "katakana-speed-tile",
              tile.selected && "katakana-speed-tile--selected"
            )}
            disabled={disabled || tile.selected}
            key={`${tile.surface}-${tile.index}`}
            onClick={() => controller.handleSelectTile(tile.index)}
            type="button"
          >
            {tile.surface}
          </button>
        ))}
      </div>
      <div className="katakana-speed-tile-actions">
        <button
          className="button button--ghost"
          disabled={disabled || state.selectedIndexes.length === 0}
          onClick={controller.handleClearTiles}
          type="button"
        >
          Reset
        </button>
        <button
          className="button button--primary"
          disabled={disabled || state.selectedIndexes.length === 0}
          onClick={controller.handleSubmitTileBuilder}
          type="button"
        >
          Salva
        </button>
      </div>
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
  const timerRunning = controller.timerState.phase === "running";

  return (
    <div className="katakana-speed-selfcheck">
      <div className="katakana-speed-timer" role="timer">
        <span className="katakana-speed-timer__value">
          {formatTimerLabel(controller.timerState.elapsedMs)}
        </span>
        <button
          className="button button--primary"
          disabled={disabled || controller.awaitingContinue}
          onClick={controller.handleToggleTimer}
          type="button"
        >
          {timerRunning ? "Stop" : "Start"}
        </button>
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
            {index + 1}
          </span>
        ))}
      </div>

      <div className="katakana-speed-timer" role="timer">
        <span className="katakana-speed-timer__value">
          {formatTimerLabel(controller.timerState.elapsedMs)}
        </span>
        <button
          className="button button--primary"
          disabled={disabled || controller.awaitingContinue}
          onClick={controller.handleToggleTimer}
          type="button"
        >
          {timerRunning ? "Stop" : "Start"}
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
            : "Passaggio successivo"}
      </button>
    </div>
  );
}

function RanGridControls({
  controller,
  disabled
}: {
  controller: ReturnType<typeof useKatakanaSpeedSessionController>;
  disabled: boolean;
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
                isWrong ? ", segnato come errore" : ""
              }`}
              aria-pressed={isWrong}
              className={`katakana-speed-ran-cell${
                isWrong ? " katakana-speed-ran-cell--wrong" : ""
              }`}
              disabled={disabled || !controller.ranCanMarkErrors}
              key={`${cell.itemId}-${index}`}
              onClick={() => controller.handleToggleRanWrongCell(index)}
              type="button"
            >
              {cell.surface}
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
            disabled={disabled || controller.awaitingContinue}
            onClick={controller.handleToggleTimer}
            type="button"
          >
            {timerRunning ? "Stop" : "Start"}
          </button>
        </div>

        <p className="katakana-speed-ran-errors" aria-live="polite">
          <span>
            {controller.ranCanMarkErrors
              ? "Tocca le celle sbagliate"
              : "Segna dopo Stop"}
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
          {controller.awaitingContinue ? "Continua" : "Salva RAN"}
        </button>
      </div>
    </div>
  );
}

function FeedbackPanel({
  clientError,
  currentTrial,
  feedback,
  isFinalizing
}: {
  clientError: string | null;
  currentTrial: KatakanaSpeedTrialPlan | null;
  feedback: ReturnType<typeof useKatakanaSpeedSessionController>["feedback"];
  isFinalizing: boolean;
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
    return (
      <div className="katakana-speed-feedback" aria-live="polite">
        <p className="katakana-speed-feedback__title">Pronto</p>
        <p className="katakana-speed-feedback__body">
          Premi il numero della risposta o usa Space per i timer.
        </p>
      </div>
    );
  }

  const meaning = currentTrial
    ? getKatakanaSpeedItemById(currentTrial.itemId)?.meaningIt
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
            ? "Corretto, lento"
            : "Corretto"}
      </p>
      <p className="katakana-speed-feedback__body">
        {feedback.selfRating
          ? `${formatSelfRating(feedback.selfRating)} in ${feedback.responseMs} ms`
          : `${feedback.selectedSurface} / ${feedback.expectedSurface} in ${feedback.responseMs} ms`}
        {meaning ? ` · ${meaning}` : ""}
      </p>
    </div>
  );
}

function formatTimerLabel(value: number) {
  return `${(value / 1000).toFixed(1)} s`;
}

function formatSelfRating(value: string) {
  if (value === "clean") {
    return "Clean";
  }
  if (value === "hesitated") {
    return "Hesitated";
  }

  return "Wrong";
}
