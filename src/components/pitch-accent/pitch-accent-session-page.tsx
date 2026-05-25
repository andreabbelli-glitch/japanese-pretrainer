"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  abandonPitchAccentSessionAction,
  completePitchAccentSessionAction
} from "@/actions/pitch-accent";
import type {
  PitchAccentAudioPitchGraph,
  PitchAccentPairOption
} from "@/features/pitch-accent/model";
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
  type PitchAccentFeedback,
  type PitchAccentReviewPlayback
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
                    activeReview={
                      controller.activeReviewGraph?.optionId === option.id
                    }
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
                    onPlay={() => controller.selectReviewGraphOption(option.id)}
                    option={option}
                  />
                ))}
              </div>

              {controller.activeReviewGraph ? (
                <PitchAccentReviewGraph
                  graph={controller.activeReviewGraph.graph}
                  option={controller.activeReviewGraph.option}
                  playback={controller.reviewPlayback}
                />
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
  activeReview = false,
  disabled,
  feedback,
  index,
  onChoose,
  onPlay,
  option
}: {
  readonly activeReview?: boolean;
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
    showAudioReplay && activeReview && "pitch-accent-option--active-review",
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

export function PitchAccentReviewGraph({
  graph,
  option,
  playback
}: {
  readonly graph: PitchAccentAudioPitchGraph | null;
  readonly option: PitchAccentPairOption;
  readonly playback: PitchAccentReviewPlayback;
}) {
  const graphData = buildReviewGraphData(graph);
  const playbackDuration =
    playback.durationSeconds > 0
      ? playback.durationSeconds
      : graph
        ? graph.durationMs / 1000
        : 0;
  const playheadPercent =
    playbackDuration > 0
      ? clamp((playback.currentTimeSeconds / playbackDuration) * 100, 0, 100)
      : 0;

  return (
    <section
      className="pitch-accent-review-graph"
      data-testid="pitch-accent-review-graph"
    >
      <div className="pitch-accent-review-graph__header">
        <h2 className="pitch-accent-review-graph__title">Pitch Graph</h2>
        <p className="pitch-accent-review-graph__subtitle jp-inline">
          {formatPitchAccentOptionLabel(option)}
        </p>
      </div>

      {graphData ? (
        <div className="pitch-accent-review-graph__plot">
          <svg
            aria-label={`Pitch graph ${formatPitchAccentOptionLabel(option)}`}
            className="pitch-accent-review-graph__svg"
            focusable="false"
            role="img"
            viewBox="0 0 640 220"
          >
            {graphData.yTicks.map((tick) => (
              <g key={`y-${tick.value}`}>
                <line
                  className="pitch-accent-review-graph__grid"
                  x1={graphData.bounds.left}
                  x2={graphData.bounds.right}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className="pitch-accent-review-graph__axis-label"
                  x={graphData.bounds.left - 12}
                  y={tick.y + 5}
                >
                  {formatPitchTick(tick.value)}
                </text>
              </g>
            ))}
            {graphData.xTicks.map((tick) => (
              <text
                className="pitch-accent-review-graph__axis-label"
                key={`x-${tick.value}`}
                x={tick.x}
                y={graphData.bounds.bottom + 24}
              >
                {formatTimeTick(tick.value)}
              </text>
            ))}
            {graphData.paths.map((path, index) => (
              <path
                className="pitch-accent-review-graph__line"
                d={path}
                key={index}
              />
            ))}
          </svg>
          <span
            aria-hidden="true"
            className="pitch-accent-review-graph__playhead"
            style={{ left: `${roundGraphPercent(playheadPercent)}%` }}
          />
        </div>
      ) : (
        <p className="pitch-accent-review-graph__fallback">
          Pitch graph non disponibile.
        </p>
      )}

      <div className="pitch-accent-review-graph__legend" aria-hidden="true">
        <span className="pitch-accent-review-graph__legend-dot" />
        <span>Pitch</span>
      </div>
    </section>
  );
}

function buildReviewGraphData(graph: PitchAccentAudioPitchGraph | null) {
  const voicedValues = graph?.values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (!graph || !voicedValues || voicedValues.length === 0) {
    return null;
  }

  const minPitch = Math.min(...voicedValues);
  const maxPitch = Math.max(...voicedValues);
  const padding = Math.max(12, (maxPitch - minPitch) * 0.16);
  const minYValue = Math.max(0, minPitch - padding);
  const maxYValue = maxPitch + padding;
  const range = Math.max(maxYValue - minYValue, 1);
  const durationSeconds = Math.max(graph.durationMs / 1000, 0.01);
  const bounds = {
    bottom: 176,
    left: 58,
    right: 612,
    top: 20
  };
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const valueToY = (value: number) =>
    bounds.bottom - ((value - minYValue) / range) * height;
  const indexToX = (index: number) => {
    const timeSeconds = (index * graph.sampleIntervalMs) / 1000;

    return bounds.left + (timeSeconds / durationSeconds) * width;
  };
  const paths: string[] = [];
  let currentPath = "";

  graph.values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (currentPath) {
        paths.push(currentPath);
        currentPath = "";
      }
      return;
    }

    const x = roundCoordinate(indexToX(index));
    const y = roundCoordinate(valueToY(value));
    currentPath = currentPath ? `${currentPath} L ${x} ${y}` : `M ${x} ${y}`;
  });
  if (currentPath) {
    paths.push(currentPath);
  }

  return {
    bounds,
    paths,
    xTicks: [0, durationSeconds / 2, durationSeconds].map((value) => ({
      value,
      x: bounds.left + (value / durationSeconds) * width
    })),
    yTicks: [maxYValue, (minYValue + maxYValue) / 2, minYValue].map(
      (value) => ({
        value,
        y: valueToY(value)
      })
    )
  };
}

function formatPitchTick(value: number) {
  return value.toFixed(1);
}

function formatTimeTick(value: number) {
  return value === 0 ? "0s" : `${value.toFixed(2)}s`;
}

function roundCoordinate(value: number) {
  return Number.parseFloat(value.toFixed(2));
}

function roundGraphPercent(value: number) {
  return Number.parseFloat(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
