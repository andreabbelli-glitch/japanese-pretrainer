"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  abandonPitchAccentSessionAction,
  completePitchAccentSessionAction
} from "@/actions/pitch-accent";
import type { PitchAccentPairOption } from "@/features/pitch-accent/model";
import type { PitchAccentSessionPageData } from "@/features/pitch-accent/server/contracts";
import { cx } from "@/lib/classnames";

import { PitchAccentNotation } from "../ui/pitch-accent-notation";
import { SurfaceCard } from "../ui/surface-card";
import {
  buildPitchAccentOptionData,
  formatPitchAccentOptionLabel
} from "./pitch-accent-shared";
import {
  usePitchAccentSessionController,
  type PitchAccentFeedback
} from "./use-pitch-accent-session-controller";

type PitchAccentSessionPageProps = {
  data: PitchAccentSessionPageData;
};

export function PitchAccentSessionPage({ data }: PitchAccentSessionPageProps) {
  const router = useRouter();
  const finalizingRef = useRef(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [reviewAudioElement, setReviewAudioElement] =
    useState<HTMLAudioElement | null>(null);
  const [pauseAfterCorrect, setPauseAfterCorrect] = useState(false);
  const [noise, setNoise] = useState(false);
  const [muffle, setMuffle] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const controller = usePitchAccentSessionController(data, {
    audioElement,
    audioModifiers: {
      muffle,
      noise
    },
    pauseAfterCorrect,
    reviewAudioElement
  });
  const currentTrial = controller.currentTrial;
  const correctOption = currentTrial
    ? currentTrial.options.find(
        (option) => option.id === currentTrial.correctOptionId
      )
    : null;
  const recapHref = `/pitch-accent/recap/${data.sessionId}` as Route;
  const isSessionFinalizing = isFinalizing || controller.completed;

  useEffect(() => {
    if (!controller.completed || finalizingRef.current) {
      return;
    }

    finalizingRef.current = true;
    void completePitchAccentSessionAction({ sessionId: data.sessionId })
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
    finalizingRef.current = true;
    setIsFinalizing(true);
    setClientError(null);

    try {
      await abandonPitchAccentSessionAction({ sessionId: data.sessionId });
      router.push(recapHref);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare l'abbandono."
      );
      finalizingRef.current = false;
      setIsFinalizing(false);
    }
  }

  if (data.status !== "active") {
    return (
      <div className="pitch-accent-session-page">
        <SurfaceCard className="pitch-accent-stage">
          <p className="pitch-accent-eyebrow">Sessione chiusa</p>
          <h1 className="pitch-accent-title">Pitch Accent</h1>
          <Link className="button button--primary" href={recapHref}>
            Apri recap
          </Link>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="pitch-accent-session-page">
      <div className="pitch-accent-session-layout">
        <SurfaceCard
          className="pitch-accent-stage"
          testId="pitch-accent-stage"
          variant="hero"
        >
          <div
            className="pitch-accent-session-top"
            data-testid="pitch-accent-top"
          >
            <p className="pitch-accent-eyebrow">Pitch Accent</p>
            <span className="pitch-accent-muted">
              {Math.min(controller.currentIndex + 1, controller.totalTrials)} /{" "}
              {controller.totalTrials}
            </span>
            <div
              aria-label={`${controller.progressPercent}% completato`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={controller.progressPercent}
              className="pitch-accent-progress"
              role="progressbar"
            >
              <span
                className="pitch-accent-progress__bar"
                style={{ width: `${controller.progressPercent}%` }}
              />
            </div>
          </div>

          {currentTrial && correctOption ? (
            <>
              <div className="pitch-accent-audio-box">
                <p className="pitch-accent-kana jp-inline">
                  {currentTrial.kana}
                </p>
                <audio
                  ref={setAudioElement}
                  className="pitch-accent-audio"
                  controls
                  preload="auto"
                  src={correctOption.audioSrc}
                />
                <button
                  className="button button--ghost"
                  onClick={controller.replayCurrentAudio}
                  type="button"
                >
                  Replay
                </button>
                <audio
                  aria-hidden="true"
                  className="pitch-accent-review-audio"
                  preload="auto"
                  ref={setReviewAudioElement}
                />
              </div>

              <div className="pitch-accent-options">
                {currentTrial.options.map((option, index) => (
                  <PitchAccentOptionButton
                    disabled={
                      (!controller.feedback && controller.isSubmitting) ||
                      Boolean(controller.feedback?.isCorrect) ||
                      isSessionFinalizing
                    }
                    feedback={controller.feedback}
                    index={index}
                    key={option.id}
                    onChoose={() =>
                      controller.handleChooseOption(option.id, "pointer")
                    }
                    onPlay={() => controller.playOptionAudio(option.id)}
                    option={option}
                  />
                ))}
              </div>

              {controller.feedback ? (
                <div
                  className={cx(
                    "pitch-accent-feedback",
                    controller.feedback.isCorrect
                      ? "pitch-accent-feedback--correct"
                      : "pitch-accent-feedback--incorrect"
                  )}
                  role="status"
                >
                  <strong>
                    {controller.feedback.isCorrect ? "Corretto" : "Da rifare"}
                  </strong>
                  <span>
                    Risposta corretta:{" "}
                    {formatPitchAccentOptionLabel(correctOption)}
                  </span>
                </div>
              ) : null}

              {controller.awaitingContinue ? (
                <button
                  className="button button--primary pitch-accent-continue"
                  disabled={controller.isSubmitting || isSessionFinalizing}
                  onClick={controller.handleContinue}
                  type="button"
                >
                  Continua
                </button>
              ) : null}
            </>
          ) : (
            <p className="pitch-accent-summary">Sessione completata.</p>
          )}

          {controller.clientError || clientError ? (
            <p className="kanji-clash-stage__error" role="alert">
              {controller.clientError ?? clientError}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="pitch-accent-panel pitch-accent-session-aside">
          <p className="pitch-accent-eyebrow">Controlli</p>
          <div className="pitch-accent-toggle-stack">
            <label className="pitch-accent-check">
              <input
                checked={pauseAfterCorrect}
                onChange={(event) => setPauseAfterCorrect(event.target.checked)}
                type="checkbox"
              />
              <span>Pausa dopo corretto</span>
            </label>
            <label className="pitch-accent-check">
              <input
                checked={noise}
                onChange={(event) => setNoise(event.target.checked)}
                type="checkbox"
              />
              <span>Rumore bianco</span>
            </label>
            <label className="pitch-accent-check">
              <input
                checked={muffle}
                onChange={(event) => setMuffle(event.target.checked)}
                type="checkbox"
              />
              <span>Muffle</span>
            </label>
          </div>
          <button
            className="button button--ghost"
            disabled={isSessionFinalizing || controller.isSubmitting}
            onClick={abandonSession}
            type="button"
          >
            Abbandona e salva recap
          </button>
        </SurfaceCard>
      </div>
    </div>
  );
}

export function PitchAccentOptionButton({
  disabled,
  feedback,
  index,
  onChoose,
  onPlay,
  option
}: {
  readonly disabled: boolean;
  readonly feedback: PitchAccentFeedback | null;
  readonly index: number;
  readonly onChoose: () => void;
  readonly onPlay: () => void;
  readonly option: PitchAccentPairOption;
}) {
  const pitchAccent = buildPitchAccentOptionData(option);
  const isCorrect = feedback?.correctOptionId === option.id;
  const isChosen = feedback?.chosenOptionId === option.id;
  const showAudioReplay = feedback !== null && !feedback.isCorrect;
  const optionClassName = cx(
    "pitch-accent-option",
    showAudioReplay && "pitch-accent-option--review",
    showAudioReplay && "pitch-accent-option--with-play",
    feedback && isCorrect && "pitch-accent-option--correct",
    feedback && isChosen && !isCorrect && "pitch-accent-option--incorrect"
  );
  const content = (
    <div className="pitch-accent-option__content">
      <span className="pitch-accent-option__key">{index + 1}</span>
      {pitchAccent ? (
        <PitchAccentNotation compact pitchAccent={pitchAccent} />
      ) : (
        <span>{formatPitchAccentOptionLabel(option)}</span>
      )}
    </div>
  );

  if (showAudioReplay) {
    return (
      <button
        aria-label={`Riproduci opzione ${index + 1}`}
        className={optionClassName}
        data-option-id={option.id}
        data-testid="pitch-accent-option"
        disabled={disabled}
        onClick={onPlay}
        type="button"
      >
        {content}
        <span className="pitch-accent-option__play">
          <span aria-hidden="true">▶</span>
        </span>
      </button>
    );
  }

  return (
    <button
      className={optionClassName}
      data-option-id={option.id}
      data-testid="pitch-accent-option"
      disabled={disabled}
      onClick={onChoose}
      type="button"
    >
      {content}
    </button>
  );
}
