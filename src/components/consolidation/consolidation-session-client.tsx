"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  markConsolidationKnownAction,
  submitConsolidationAnswerAction
} from "@/actions/consolidation";
import { cx } from "@/lib/classnames";
import {
  type ConsolidationAnswerResult,
  type ConsolidationOption,
  type ConsolidationSessionData,
  type ConsolidationSessionSubject
} from "@/lib/consolidation";
import { stripInlineMarkdown } from "@/lib/render-furigana";

import styles from "./consolidation-session.module.css";

const RETRIEVAL_MS = 2000;
const FEEDBACK_MS = 650;

type SessionPhase = "retrieval" | "answering" | "feedback";
type FeedbackState =
  | {
      correct: boolean;
      message: string;
      selectedSubjectKey: string | null;
    }
  | null;

export function ConsolidationSessionClient({
  data
}: {
  data: ConsolidationSessionData;
}) {
  const [subjects, setSubjects] = useState(data.subjects);
  const subjectsByKey = useMemo(
    () => new Map(subjects.map((subject) => [subject.subjectKey, subject])),
    [subjects]
  );
  const [queue, setQueue] = useState(() =>
    data.subjects.map((subject) => subject.subjectKey)
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<SessionPhase>("retrieval");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timersRef = useRef<number[]>([]);

  const currentSubject = subjectsByKey.get(queue[0] ?? "") ?? null;
  const currentStep = currentSubject?.steps[stepIndex] ?? null;
  const completed = queue.length === 0 || !currentSubject || !currentStep;
  const clearSessionTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }

    timersRef.current = [];
  }, []);

  useEffect(() => {
    setSubjects(data.subjects);
    setQueue(data.subjects.map((subject) => subject.subjectKey));
    setStepIndex(0);
    setPhase("retrieval");
    setFeedback(null);
    setIsSubmitting(false);
  }, [data.subjects]);

  useEffect(() => {
    clearSessionTimers();

    if (completed || phase !== "retrieval") {
      return;
    }

    const timer = window.setTimeout(() => {
      setPhase("answering");
    }, RETRIEVAL_MS);
    timersRef.current.push(timer);

    return clearSessionTimers;
  }, [
    clearSessionTimers,
    completed,
    currentSubject?.subjectKey,
    currentStep?.step,
    phase
  ]);

  useEffect(() => clearSessionTimers, [clearSessionTimers]);

  const scheduleNext = (callback: () => void) => {
    const timer = window.setTimeout(callback, FEEDBACK_MS);
    timersRef.current.push(timer);
  };

  const handleAnswer = async (option: ConsolidationOption) => {
    if (!currentSubject || !currentStep || phase !== "answering" || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPhase("feedback");
    setFeedback({
      correct: option.subjectKey === currentSubject.subjectKey,
      message:
        option.subjectKey === currentSubject.subjectKey
          ? "Corretto"
          : "Da riprovare",
      selectedSubjectKey: option.subjectKey
    });

    try {
      const result = await submitConsolidationAnswerAction({
        selectedSubjectKey: option.subjectKey,
        step: currentStep.step,
        subjectKey: currentSubject.subjectKey
      });

      setFeedback({
        correct: result.correct,
        message: result.correct ? "Corretto" : "Da riprovare",
        selectedSubjectKey: option.subjectKey
      });
      scheduleNext(() => applyAnswerResult(result));
    } catch {
      setFeedback({
        correct: false,
        message: "Risposta non salvata",
        selectedSubjectKey: option.subjectKey
      });
      scheduleNext(() => {
        setIsSubmitting(false);
        setPhase("answering");
      });
    }
  };

  const handleMarkKnown = async () => {
    if (!currentSubject || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPhase("feedback");
    setFeedback({
      correct: true,
      message: "Già nota",
      selectedSubjectKey: currentSubject.subjectKey
    });

    try {
      const result = await markConsolidationKnownAction({
        subjectKey: currentSubject.subjectKey
      });

      scheduleNext(() => applyAnswerResult(result));
    } catch {
      setFeedback({
        correct: false,
        message: "Stato non salvato",
        selectedSubjectKey: currentSubject.subjectKey
      });
      scheduleNext(() => {
        setIsSubmitting(false);
        setPhase("answering");
      });
    }
  };

  const applyAnswerResult = (result: ConsolidationAnswerResult) => {
    if (result.completed) {
      setQueue((current) =>
        current.filter((subjectKey) => subjectKey !== result.subjectKey)
      );
      setStepIndex(0);
      setFeedback(null);
      setIsSubmitting(false);
      setPhase("retrieval");
      return;
    }

    if (result.correct && result.nextStep === "meaning") {
      setStepIndex((current) => current + 1);
      setFeedback(null);
      setIsSubmitting(false);
      setPhase("retrieval");
      return;
    }

    setQueue((current) =>
      reinsertSubject(current, result.subjectKey, result.reinsertionIndex)
    );
    setSubjects((current) =>
      current.map((subject) =>
        subject.subjectKey === result.subjectKey
          ? advanceSubjectAttempt(subject, result.attemptCount)
          : subject
      )
    );
    setStepIndex(0);
    setFeedback(null);
    setIsSubmitting(false);
    setPhase("retrieval");
  };

  if (completed) {
    return (
      <section className={styles.shell} aria-labelledby="consolidation-complete">
        <div className={styles.completePanel}>
          <p className={styles.eyebrow}>{data.media.title}</p>
          <h1 id="consolidation-complete">Consolidamento completato</h1>
          <Link className="button button--primary" href={data.reviewHref}>
            Vai alla review
          </Link>
        </div>
      </section>
    );
  }

  const remainingCount = queue.length;
  const currentStepNumber = stepIndex + 1;
  const totalSteps = currentSubject.steps.length;

  return (
    <section className={styles.shell} aria-labelledby="consolidation-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{data.media.title}</p>
          <h1 id="consolidation-title">{data.lesson.title}</h1>
        </div>
        <div className={styles.counter} aria-label="Card rimanenti">
          {remainingCount}
        </div>
      </header>

      <div
        className={styles.stage}
        data-phase={phase}
        data-step={currentStep.step}
      >
        <div className={styles.stageTopline}>
          <span>{currentStep.step === "reading" ? "Lettura" : "Significato"}</span>
          <span>
            {currentStepNumber}/{totalSteps}
          </span>
        </div>

        <div className={styles.frontPanel}>
          <p className={styles.frontLabel}>Fronte</p>
          <h2 className={styles.frontText}>
            {stripInlineMarkdown(currentSubject.front)}
          </h2>
        </div>

        {phase === "retrieval" ? (
          <div
            aria-hidden="true"
            className={styles.retrievalPlaceholder}
            data-testid="consolidation-retrieval-placeholder"
          >
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} />
            </div>
            <div className={styles.retrievalSurface} />
          </div>
        ) : (
          <div className={styles.optionsWrap}>
            <div
              aria-live="polite"
              className={cx(
                styles.feedback,
                feedback?.correct === true && styles.feedbackCorrect,
                feedback?.correct === false && styles.feedbackWrong
              )}
            >
              {feedback?.message ?? " "}
            </div>
            <div className={styles.optionsGrid}>
              {currentStep.options.map((option) => {
                const isSelected =
                  feedback?.selectedSubjectKey === option.subjectKey;
                const isCorrect = option.subjectKey === currentSubject.subjectKey;

                return (
                  <button
                    aria-pressed={isSelected || undefined}
                    className={cx(
                      styles.optionButton,
                      phase === "feedback" && isCorrect && styles.optionCorrect,
                      phase === "feedback" &&
                        isSelected &&
                        !isCorrect &&
                        styles.optionWrong
                    )}
                    disabled={isSubmitting || phase === "feedback"}
                    key={`${currentStep.step}:${option.subjectKey}:${option.label}`}
                    type="button"
                    onClick={() => void handleAnswer(option)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer className={styles.actions}>
        <Link className="button button--ghost" href={data.hubHref}>
          Hub
        </Link>
        <button
          className="button button--secondary"
          disabled={isSubmitting}
          type="button"
          onClick={() => void handleMarkKnown()}
        >
          Già nota
        </button>
      </footer>
    </section>
  );
}

function advanceSubjectAttempt(
  subject: ConsolidationSessionSubject,
  attemptCount: number
): ConsolidationSessionSubject {
  return {
    ...subject,
    attemptCount,
    steps: subject.steps.map((step) => ({
      ...step,
      options: deterministicShuffle(
        step.options,
        `${subject.subjectKey}:${step.step}:${attemptCount}`
      )
    }))
  };
}

function reinsertSubject(
  queue: string[],
  subjectKey: string,
  reinsertionIndex: number | null
) {
  const withoutSubject = queue.filter((item) => item !== subjectKey);
  const safeIndex =
    reinsertionIndex === null
      ? withoutSubject.length
      : Math.max(0, Math.min(withoutSubject.length, reinsertionIndex));

  return [
    ...withoutSubject.slice(0, safeIndex),
    subjectKey,
    ...withoutSubject.slice(safeIndex)
  ];
}

function deterministicShuffle<T>(items: T[], seed: string) {
  return [...items]
    .map((item, index) => ({
      item,
      rank: hashString(`${seed}:${index}`)
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
