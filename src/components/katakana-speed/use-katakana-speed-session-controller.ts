"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  aggregateKatakanaSpeedExerciseResultAction,
  submitKatakanaSpeedAnswerAction,
  submitKatakanaSpeedSelfCheckAction
} from "@/actions/katakana-speed";
import { getKatakanaSpeedItemById } from "@/features/katakana-speed/model/catalog";
import { decodeKatakanaSpeedRawOption } from "@/features/katakana-speed/model/exercise-catalog";
import {
  scoreKatakanaSpeedRanGrid,
  scoreKatakanaSpeedRepeatedReading
} from "@/features/katakana-speed/model/scoring";
import type { StartKatakanaSpeedSessionResult } from "@/features/katakana-speed/server";
import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedSelfRating,
  KatakanaSpeedTrialPlan
} from "@/features/katakana-speed/types";

export type KatakanaSpeedFeedbackStatus =
  | "correct-fast"
  | "correct-slow"
  | "incorrect";

export type KatakanaSpeedSessionOption = {
  readonly itemId: string;
  readonly reading: string;
  readonly surface: string;
};

export type KatakanaSpeedSessionFeedback = {
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly expectedSurface: string;
  readonly responseMs: number;
  readonly selfRating?: KatakanaSpeedSelfRating;
  readonly selectedSurface: string;
  readonly status: KatakanaSpeedFeedbackStatus;
  readonly trialId: string;
};

export type KatakanaSpeedTimerState = {
  readonly elapsedMs: number;
  readonly phase: "idle" | "running" | "stopped";
};

export type KatakanaSpeedSessionControllerResult = {
  readonly awaitingContinue: boolean;
  readonly clientError: string | null;
  readonly completed: boolean;
  readonly currentIndex: number;
  readonly currentTrial: KatakanaSpeedTrialPlan | null;
  readonly feedback: KatakanaSpeedSessionFeedback | null;
  readonly handleChooseOption: (
    itemId: string,
    inputMethod: "keyboard" | "pointer" | "touch"
  ) => void;
  readonly handleContinue: () => void;
  readonly handleContinueRepeatedReading: () => void;
  readonly handleSubmitRanGrid: () => void;
  readonly handleSubmitSelfCheck: (selfRating: KatakanaSpeedSelfRating) => void;
  readonly handleSubmitTileBuilder: () => void;
  readonly handleClearTiles: () => void;
  readonly handleSelectTile: (index: number) => void;
  readonly handleToggleRanWrongCell: (index: number) => void;
  readonly handleToggleTimer: () => void;
  readonly isRanGridTrial: boolean;
  readonly isRepeatedReadingTrial: boolean;
  readonly isSegmentSelectTrial: boolean;
  readonly isSelfCheckTrial: boolean;
  readonly isTileBuilderTrial: boolean;
  readonly isSubmitting: boolean;
  readonly options: readonly KatakanaSpeedSessionOption[];
  readonly progressPercent: number;
  readonly ranCanMarkErrors: boolean;
  readonly ranErrorCount: number;
  readonly ranGridCells: readonly KatakanaSpeedRanGridCell[];
  readonly ranWrongCellIndexes: readonly number[];
  readonly repeatedReadingState: KatakanaSpeedRepeatedReadingState | null;
  readonly selfCheckRatings: readonly KatakanaSpeedSelfCheckRatingOption[];
  readonly tileBuilderState: KatakanaSpeedTileBuilderState | null;
  readonly timerState: KatakanaSpeedTimerState;
  readonly totalTrials: number;
};

export type KatakanaSpeedRanGridCell = {
  readonly itemId: string;
  readonly surface: string;
};

export type KatakanaSpeedRepeatedReadingState = {
  readonly currentPassIndex: number;
  readonly durationsMs: readonly number[];
  readonly passCount: number;
  readonly trials: readonly KatakanaSpeedTrialPlan[];
};

export type KatakanaSpeedSelfCheckRatingOption = {
  readonly description: string;
  readonly key: string;
  readonly label: string;
  readonly value: KatakanaSpeedSelfRating;
};

export type KatakanaSpeedTile = {
  readonly index: number;
  readonly selected: boolean;
  readonly surface: string;
};

export type KatakanaSpeedTileBuilderState = {
  readonly answerSurface: string;
  readonly selectedIndexes: readonly number[];
  readonly tiles: readonly KatakanaSpeedTile[];
};

const SELF_CHECK_RATINGS: readonly KatakanaSpeedSelfCheckRatingOption[] = [
  {
    description: "Fluida",
    key: "1",
    label: "Clean",
    value: "clean"
  },
  {
    description: "Con esitazione",
    key: "2",
    label: "Hesitated",
    value: "hesitated"
  },
  {
    description: "Da rifare",
    key: "3",
    label: "Wrong",
    value: "wrong"
  }
];

export function useKatakanaSpeedSessionController(
  session: StartKatakanaSpeedSessionResult & { readonly answeredCount?: number }
): KatakanaSpeedSessionControllerResult {
  const initialIndex = Math.min(
    Math.max(0, session.answeredCount ?? 0),
    session.trials.length
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [feedback, setFeedback] = useState<KatakanaSpeedSessionFeedback | null>(
    null
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [timerState, setTimerState] = useState<KatakanaSpeedTimerState>({
    elapsedMs: 0,
    phase: "idle"
  });
  const [continueToIndex, setContinueToIndex] = useState<number | null>(null);
  const [ranWrongCellIndexes, setRanWrongCellIndexes] = useState<number[]>([]);
  const [repeatedPassDurations, setRepeatedPassDurations] = useState<number[]>(
    []
  );
  const [repeatedPassIndex, setRepeatedPassIndex] = useState(0);
  const [selectedTileIndexes, setSelectedTileIndexes] = useState<number[]>([]);
  const presentedAtRef = useRef(performance.now());
  const timerStartedAtRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const currentTrial = session.trials[currentIndex] ?? null;
  const completed = currentIndex >= session.trials.length;
  const totalTrials = session.trials.length;
  const isSelfCheckTrial = currentTrial
    ? isSelfCheckMode(currentTrial.mode)
    : false;
  const isRepeatedReadingTrial = currentTrial?.mode === "repeated_reading_pass";
  const isRanGridTrial = currentTrial?.mode === "ran_grid";
  const interaction = currentTrial?.features?.interaction;
  const isTileBuilderTrial = interaction === "tile_builder";
  const isSegmentSelectTrial = interaction === "segment_select";
  const isTimedTrial =
    isSelfCheckTrial || isRepeatedReadingTrial || isRanGridTrial;
  const currentBlockTrials = useMemo(() => {
    if (!currentTrial) {
      return [];
    }
    if (!currentTrial.blockId) {
      return [currentTrial];
    }

    const blockTrials: KatakanaSpeedTrialPlan[] = [];
    for (let index = currentIndex; index < session.trials.length; index += 1) {
      const trial = session.trials[index];
      if (!trial || trial.blockId !== currentTrial.blockId) {
        break;
      }
      blockTrials.push(trial);
    }

    return blockTrials.length > 0 ? blockTrials : [currentTrial];
  }, [currentIndex, currentTrial, session.trials]);

  useEffect(() => {
    presentedAtRef.current = performance.now();
    timerStartedAtRef.current = null;
    setAwaitingContinue(false);
    setContinueToIndex(null);
    setRanWrongCellIndexes([]);
    setRepeatedPassDurations([]);
    setRepeatedPassIndex(0);
    setSelectedTileIndexes([]);
    setTimerState({ elapsedMs: 0, phase: "idle" });
  }, [currentTrial?.trialId]);

  const options = useMemo(
    () =>
      (currentTrial?.optionItemIds ?? []).map((itemId) => {
        const item = getKatakanaSpeedItemById(itemId);

        return {
          itemId,
          reading: item?.reading ?? "",
          surface: item?.surface ?? decodeKatakanaSpeedRawOption(itemId)
        };
      }),
    [currentTrial?.optionItemIds]
  );

  const tileBuilderState = useMemo(() => {
    if (!currentTrial || !isTileBuilderTrial) {
      return null;
    }

    const tileSurfaces = parseStringArray(currentTrial.features?.tiles);
    const tiles = tileSurfaces.map((surface, index) => ({
      index,
      selected: selectedTileIndexes.includes(index),
      surface
    }));
    const answerSurface = selectedTileIndexes
      .map((index) => tileSurfaces[index] ?? "")
      .join("");

    return {
      answerSurface,
      selectedIndexes: selectedTileIndexes,
      tiles
    };
  }, [currentTrial, isTileBuilderTrial, selectedTileIndexes]);

  const ranGridCells = useMemo(() => {
    if (!currentTrial || !isRanGridTrial) {
      return [];
    }

    const featureSurfaces = parseStringArray(
      currentTrial.features?.gridSurfaces
    );
    const featureItemIds = parseStringArray(currentTrial.features?.gridItemIds);
    const sourceCells =
      featureSurfaces.length > 0
        ? featureSurfaces.map((surface, index) => ({
            itemId: featureItemIds[index] ?? `${currentTrial.itemId}-${index}`,
            surface
          }))
        : currentBlockTrials.map((trial) => ({
            itemId: trial.itemId,
            surface: trial.promptSurface
          }));

    return Array.from({ length: 25 }, (_, index) => {
      const sourceCell = sourceCells[index % Math.max(1, sourceCells.length)];

      return {
        itemId: sourceCell?.itemId ?? currentTrial.itemId,
        surface: sourceCell?.surface ?? currentTrial.promptSurface
      };
    });
  }, [currentBlockTrials, currentTrial, isRanGridTrial]);
  const ranCanMarkErrors =
    isRanGridTrial && timerState.phase === "stopped" && !awaitingContinue;
  const ranErrorCount = ranWrongCellIndexes.length;

  const repeatedReadingState = isRepeatedReadingTrial
    ? {
        currentPassIndex: repeatedPassIndex,
        durationsMs: repeatedPassDurations,
        passCount: currentBlockTrials.length,
        trials: currentBlockTrials
      }
    : null;

  const handleToggleTimer = useCallback(() => {
    if (!currentTrial || !isTimedTrial || submittingRef.current) {
      return;
    }

    if (timerState.phase === "running") {
      const startedAt = timerStartedAtRef.current ?? presentedAtRef.current;
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
      timerStartedAtRef.current = null;
      if (isRepeatedReadingTrial) {
        setRepeatedPassDurations((durations) =>
          replaceDuration(durations, repeatedPassIndex, elapsedMs)
        );
      }
      setTimerState({
        elapsedMs,
        phase: "stopped"
      });
      return;
    }

    timerStartedAtRef.current = performance.now();
    setTimerState({
      elapsedMs: 0,
      phase: "running"
    });
  }, [
    currentTrial,
    isRepeatedReadingTrial,
    isTimedTrial,
    repeatedPassIndex,
    timerState.phase
  ]);

  const handleChooseOption = useCallback(
    async (
      itemId: string,
      inputMethod: "keyboard" | "pointer" | "touch"
    ): Promise<void> => {
      if (!currentTrial || submittingRef.current) {
        return;
      }

      const selectedItem = getKatakanaSpeedItemById(itemId);
      const expectedItem = getKatakanaSpeedItemById(currentTrial.correctItemId);
      const selectedSurface =
        selectedItem?.surface ?? decodeKatakanaSpeedRawOption(itemId);
      const expectedSurface =
        currentTrial.expectedSurface ??
        expectedItem?.surface ??
        currentTrial.promptSurface;
      const responseMs = Math.max(
        0,
        Math.round(performance.now() - presentedAtRef.current)
      );
      const isCorrect = selectedSurface === expectedSurface;

      submittingRef.current = true;
      setIsSubmitting(true);
      setClientError(null);
      setFeedback({
        errorTags: [],
        expectedSurface,
        responseMs,
        selectedSurface,
        status: isCorrect
          ? responseMs <= currentTrial.targetRtMs
            ? "correct-fast"
            : "correct-slow"
          : "incorrect",
        trialId: currentTrial.trialId
      });

      try {
        const result = await submitKatakanaSpeedAnswerAction({
          inputMethod,
          responseMs,
          sessionId: session.sessionId,
          trialId: currentTrial.trialId,
          userAnswer: selectedSurface
        });

        setFeedback({
          errorTags: result.errorTags,
          expectedSurface,
          responseMs,
          selectedSurface,
          status: result.isCorrect
            ? responseMs <= currentTrial.targetRtMs
              ? "correct-fast"
              : "correct-slow"
            : "incorrect",
          trialId: currentTrial.trialId
        });
        setCurrentIndex((index) => Math.min(index + 1, totalTrials));
      } catch (error) {
        setClientError(
          error instanceof Error
            ? error.message
            : "Impossibile salvare la risposta."
        );
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [currentTrial, session.sessionId, totalTrials]
  );

  const handleSubmitSelfCheck = useCallback(
    async (selfRating: KatakanaSpeedSelfRating): Promise<void> => {
      if (!currentTrial || !isSelfCheckTrial || submittingRef.current) {
        return;
      }

      const responseMs = computeSelfCheckResponseMs({
        presentedAt: presentedAtRef.current,
        timerStartedAt: timerStartedAtRef.current,
        timerState
      });
      const expectedSurface = currentTrial.promptSurface;
      const status: KatakanaSpeedFeedbackStatus =
        selfRating === "wrong"
          ? "incorrect"
          : selfRating === "hesitated" || responseMs > currentTrial.targetRtMs
            ? "correct-slow"
            : "correct-fast";
      const metricsJson = buildSelfCheckMetrics(currentTrial, responseMs);

      submittingRef.current = true;
      setIsSubmitting(true);
      setClientError(null);
      setFeedback({
        errorTags: [],
        expectedSurface,
        responseMs,
        selfRating,
        selectedSurface: selfRating,
        status,
        trialId: currentTrial.trialId
      });

      try {
        const result = await submitKatakanaSpeedSelfCheckAction({
          metricsJson,
          responseMs,
          selfRating,
          sessionId: session.sessionId,
          trialId: currentTrial.trialId
        });

        setFeedback({
          errorTags: result.isCorrect ? [] : ["unclassified_error"],
          expectedSurface,
          responseMs,
          selfRating: result.selfRating,
          selectedSurface: result.selfRating,
          status: result.isCorrect ? status : "incorrect",
          trialId: currentTrial.trialId
        });
        setAwaitingContinue(true);
        setContinueToIndex(Math.min(currentIndex + 1, totalTrials));
      } catch (error) {
        setClientError(
          error instanceof Error
            ? error.message
            : "Impossibile salvare l'autovalutazione."
        );
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [
      currentIndex,
      currentTrial,
      isSelfCheckTrial,
      session.sessionId,
      timerState,
      totalTrials
    ]
  );

  const handleSelectTile = useCallback(
    (index: number) => {
      if (!isTileBuilderTrial || submittingRef.current || awaitingContinue) {
        return;
      }

      const tileCount = parseStringArray(currentTrial?.features?.tiles).length;
      const normalizedIndex = Math.round(index);
      if (
        !Number.isFinite(normalizedIndex) ||
        normalizedIndex < 0 ||
        normalizedIndex >= tileCount
      ) {
        return;
      }

      setSelectedTileIndexes((current) =>
        current.includes(normalizedIndex)
          ? current
          : [...current, normalizedIndex]
      );
    },
    [awaitingContinue, currentTrial?.features?.tiles, isTileBuilderTrial]
  );

  const handleClearTiles = useCallback(() => {
    if (!isTileBuilderTrial || submittingRef.current || awaitingContinue) {
      return;
    }

    setSelectedTileIndexes([]);
  }, [awaitingContinue, isTileBuilderTrial]);

  const handleSubmitTileBuilder = useCallback(async (): Promise<void> => {
    if (
      !currentTrial ||
      !isTileBuilderTrial ||
      submittingRef.current ||
      awaitingContinue
    ) {
      return;
    }

    const tileSurfaces = parseStringArray(currentTrial.features?.tiles);
    const userAnswer = selectedTileIndexes
      .map((index) => tileSurfaces[index] ?? "")
      .join("");
    if (!userAnswer) {
      return;
    }

    const expectedItem = getKatakanaSpeedItemById(currentTrial.correctItemId);
    const expectedSurface =
      currentTrial.expectedSurface ??
      expectedItem?.surface ??
      currentTrial.promptSurface;
    const responseMs = Math.max(
      0,
      Math.round(performance.now() - presentedAtRef.current)
    );
    const isCorrect = userAnswer === expectedSurface;

    submittingRef.current = true;
    setIsSubmitting(true);
    setClientError(null);
    setFeedback({
      errorTags: [],
      expectedSurface,
      responseMs,
      selectedSurface: userAnswer,
      status: isCorrect
        ? responseMs <= currentTrial.targetRtMs
          ? "correct-fast"
          : "correct-slow"
        : "incorrect",
      trialId: currentTrial.trialId
    });

    try {
      const result = await submitKatakanaSpeedAnswerAction({
        inputMethod: "pointer",
        responseMs,
        sessionId: session.sessionId,
        trialId: currentTrial.trialId,
        userAnswer
      });

      setFeedback({
        errorTags: result.errorTags,
        expectedSurface,
        responseMs,
        selectedSurface: userAnswer,
        status: result.isCorrect
          ? responseMs <= currentTrial.targetRtMs
            ? "correct-fast"
            : "correct-slow"
          : "incorrect",
        trialId: currentTrial.trialId
      });
      setCurrentIndex((index) => Math.min(index + 1, totalTrials));
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare la risposta."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    awaitingContinue,
    currentTrial,
    isTileBuilderTrial,
    selectedTileIndexes,
    session.sessionId,
    totalTrials
  ]);

  const handleContinueRepeatedReading = useCallback(async (): Promise<void> => {
    if (
      !currentTrial ||
      !isRepeatedReadingTrial ||
      submittingRef.current ||
      awaitingContinue
    ) {
      return;
    }
    if (timerState.phase !== "stopped") {
      return;
    }

    const durationMs = computeSelfCheckResponseMs({
      presentedAt: presentedAtRef.current,
      timerStartedAt: timerStartedAtRef.current,
      timerState
    });
    const nextDurations = replaceDuration(
      repeatedPassDurations,
      repeatedPassIndex,
      durationMs
    );

    if (repeatedPassIndex < currentBlockTrials.length - 1) {
      setRepeatedPassDurations(nextDurations);
      setRepeatedPassIndex((index) => index + 1);
      timerStartedAtRef.current = null;
      presentedAtRef.current = performance.now();
      setTimerState({ elapsedMs: 0, phase: "idle" });
      return;
    }

    if (!currentTrial.blockId || !currentTrial.exerciseId) {
      setClientError("Blocco repeated reading non valido.");
      return;
    }

    const firstPassMs = nextDurations[0] ?? 0;
    const repeatedPassMs = nextDurations[1] ?? firstPassMs;
    const transferPassMs = nextDurations[2] ?? repeatedPassMs;
    const score = scoreKatakanaSpeedRepeatedReading({
      firstPassMs,
      repeatedPassMs,
      transferPassMs
    });
    const metricsJson = {
      firstPassMs,
      focusChunks: [
        ...new Set(
          currentBlockTrials.flatMap((trial) => trial.focusChunks ?? [])
        )
      ],
      improvementRatio: score.improvementRatio,
      passCount: currentBlockTrials.length,
      repeatedPassMs,
      transferPassMs,
      transferStatus: score.transferStatus,
      trialIds: currentBlockTrials.map((trial) => trial.trialId)
    };

    submittingRef.current = true;
    setIsSubmitting(true);
    setClientError(null);

    try {
      await aggregateKatakanaSpeedExerciseResultAction({
        blockId: currentTrial.blockId,
        exerciseId: currentTrial.exerciseId,
        metricsJson,
        resultId: `${currentTrial.blockId}:aggregate`,
        sessionId: session.sessionId,
        sortOrder: currentTrial.sortOrder ?? currentIndex,
        trialId: currentTrial.trialId
      });

      setFeedback({
        errorTags: [],
        expectedSurface: currentTrial.promptSurface,
        responseMs: transferPassMs,
        selectedSurface: score.transferStatus,
        status:
          score.transferStatus === "retained" ? "correct-fast" : "correct-slow",
        trialId: currentTrial.trialId
      });
      setRepeatedPassDurations(nextDurations);
      setAwaitingContinue(true);
      setContinueToIndex(
        Math.min(currentIndex + currentBlockTrials.length, totalTrials)
      );
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare il repeated reading."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    awaitingContinue,
    currentBlockTrials,
    currentIndex,
    currentTrial,
    isRepeatedReadingTrial,
    repeatedPassDurations,
    repeatedPassIndex,
    session.sessionId,
    timerState,
    totalTrials
  ]);

  const handleToggleRanWrongCell = useCallback(
    (index: number) => {
      if (
        !isRanGridTrial ||
        timerState.phase !== "stopped" ||
        awaitingContinue ||
        submittingRef.current
      ) {
        return;
      }

      const normalizedIndex = Math.round(index);
      if (
        !Number.isFinite(normalizedIndex) ||
        normalizedIndex < 0 ||
        normalizedIndex >= ranGridCells.length
      ) {
        return;
      }

      setRanWrongCellIndexes((current) => {
        const next = new Set(current);
        if (next.has(normalizedIndex)) {
          next.delete(normalizedIndex);
        } else {
          next.add(normalizedIndex);
        }

        return [...next].sort((left, right) => left - right);
      });
    },
    [awaitingContinue, isRanGridTrial, ranGridCells.length, timerState.phase]
  );

  const handleSubmitRanGrid = useCallback(async (): Promise<void> => {
    if (
      !currentTrial ||
      !isRanGridTrial ||
      submittingRef.current ||
      awaitingContinue
    ) {
      return;
    }
    if (timerState.phase !== "stopped") {
      return;
    }
    if (!currentTrial.blockId || !currentTrial.exerciseId) {
      setClientError("Blocco RAN non valido.");
      return;
    }

    const durationMs = computeSelfCheckResponseMs({
      presentedAt: presentedAtRef.current,
      timerStartedAt: timerStartedAtRef.current,
      timerState
    });
    const totalItems = ranGridCells.length;
    const cellSnapshots = buildRanGridCellSnapshots(ranGridCells);
    const wrongCellIndexes = uniqueSortedIndexes(
      ranWrongCellIndexes,
      totalItems
    );
    const wrongCells = wrongCellIndexes.flatMap((index) => {
      const cell = cellSnapshots[index];
      return cell ? [cell] : [];
    });
    const errors = wrongCellIndexes.length;
    const correctItems = totalItems - errors;
    const score = scoreKatakanaSpeedRanGrid({
      correctItems,
      responseMs: durationMs,
      totalItems
    });
    const metricsJson = {
      adjustedItemsPerSecond: score.adjustedItemsPerSecond,
      cells: cellSnapshots,
      cellItemIds: ranGridCells.map((cell) => cell.itemId),
      cellSurfaces: ranGridCells.map((cell) => cell.surface),
      columns: 5,
      correctItems,
      durationMs,
      errorRate: totalItems > 0 ? roundTo(errors / totalItems, 3) : 0,
      errors,
      itemsPerSecond: score.itemsPerSecond,
      rows: 5,
      schemaVersion: 1,
      totalItems,
      wrongCellIndexes,
      wrongCells
    };

    submittingRef.current = true;
    setIsSubmitting(true);
    setClientError(null);

    try {
      await aggregateKatakanaSpeedExerciseResultAction({
        blockId: currentTrial.blockId,
        exerciseId: currentTrial.exerciseId,
        metricsJson,
        resultId: `${currentTrial.blockId}:aggregate`,
        sessionId: session.sessionId,
        sortOrder: currentTrial.sortOrder ?? currentIndex,
        trialId: currentTrial.trialId
      });

      setFeedback({
        errorTags: [],
        expectedSurface: `${totalItems} cells`,
        responseMs: durationMs,
        selectedSurface: `${correctItems}/${totalItems}`,
        status: errors === 0 ? "correct-fast" : "correct-slow",
        trialId: currentTrial.trialId
      });
      setAwaitingContinue(true);
      setContinueToIndex(
        Math.min(currentIndex + currentBlockTrials.length, totalTrials)
      );
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare la RAN Grid."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    awaitingContinue,
    currentBlockTrials.length,
    currentIndex,
    currentTrial,
    isRanGridTrial,
    ranGridCells,
    ranWrongCellIndexes,
    session.sessionId,
    timerState,
    totalTrials
  ]);

  const handleContinue = useCallback(() => {
    if (!awaitingContinue || submittingRef.current) {
      return;
    }

    setAwaitingContinue(false);
    setContinueToIndex(null);
    setFeedback(null);
    setCurrentIndex((index) =>
      Math.min(continueToIndex ?? index + 1, totalTrials)
    );
  }, [awaitingContinue, continueToIndex, totalTrials]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (isSelfCheckTrial || isRepeatedReadingTrial || isRanGridTrial) {
        if (
          (event.key === " " || event.key === "Enter") &&
          isActivationTarget(event.target)
        ) {
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          handleToggleTimer();
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          if (awaitingContinue) {
            handleContinue();
          } else if (isRepeatedReadingTrial) {
            void handleContinueRepeatedReading();
          } else if (isRanGridTrial) {
            void handleSubmitRanGrid();
          }
          return;
        }

        if (!isSelfCheckTrial) {
          return;
        }

        const rating = SELF_CHECK_RATINGS.find(
          (candidate) => candidate.key === event.key
        );
        if (rating) {
          event.preventDefault();
          void handleSubmitSelfCheck(rating.value);
        }

        return;
      }

      const optionIndex = Number(event.key) - 1;
      const option = options[optionIndex];

      if (!option) {
        return;
      }

      event.preventDefault();
      void handleChooseOption(option.itemId, "keyboard");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleChooseOption,
    handleContinue,
    handleContinueRepeatedReading,
    handleSubmitSelfCheck,
    handleSubmitRanGrid,
    handleToggleRanWrongCell,
    handleToggleTimer,
    awaitingContinue,
    isRanGridTrial,
    isRepeatedReadingTrial,
    isSelfCheckTrial,
    options
  ]);

  return {
    awaitingContinue,
    clientError,
    completed,
    currentIndex,
    currentTrial,
    feedback,
    handleChooseOption,
    handleContinue,
    handleContinueRepeatedReading,
    handleSubmitRanGrid,
    handleSubmitSelfCheck,
    handleSubmitTileBuilder,
    handleClearTiles,
    handleSelectTile,
    handleToggleRanWrongCell,
    handleToggleTimer,
    isRanGridTrial,
    isRepeatedReadingTrial,
    isSegmentSelectTrial,
    isSelfCheckTrial,
    isTileBuilderTrial,
    isSubmitting,
    options,
    progressPercent:
      totalTrials > 0 ? Math.round((currentIndex / totalTrials) * 100) : 100,
    ranCanMarkErrors,
    ranErrorCount,
    ranGridCells,
    ranWrongCellIndexes,
    repeatedReadingState,
    selfCheckRatings: SELF_CHECK_RATINGS,
    tileBuilderState,
    timerState,
    totalTrials
  };
}

function isSelfCheckMode(mode: KatakanaSpeedTrialPlan["mode"]) {
  return (
    mode === "word_naming" ||
    mode === "pseudoword_sprint" ||
    mode === "sentence_sprint"
  );
}

function computeSelfCheckResponseMs(input: {
  presentedAt: number;
  timerStartedAt: number | null;
  timerState: KatakanaSpeedTimerState;
}) {
  if (input.timerState.phase === "stopped") {
    return input.timerState.elapsedMs;
  }
  if (input.timerState.phase === "running") {
    return Math.max(
      0,
      Math.round(
        performance.now() - (input.timerStartedAt ?? input.presentedAt)
      )
    );
  }

  return Math.max(0, Math.round(performance.now() - input.presentedAt));
}

function buildSelfCheckMetrics(
  trial: KatakanaSpeedTrialPlan,
  responseMs: number
) {
  const item = getKatakanaSpeedItemById(trial.itemId);
  const moraCount =
    typeof trial.features?.moraCount === "number"
      ? trial.features.moraCount
      : (item?.moraCount ?? 1);

  return {
    durationMs: responseMs,
    focusChunks: trial.focusChunks ?? item?.focusChunks ?? [],
    mode: trial.mode,
    moraCount,
    msPerMora: Math.round(responseMs / Math.max(1, moraCount))
  };
}

function replaceDuration(
  durations: readonly number[],
  index: number,
  durationMs: number
) {
  const nextDurations = [...durations];
  nextDurations[index] = durationMs;
  return nextDurations;
}

function buildRanGridCellSnapshots(
  cells: readonly KatakanaSpeedRanGridCell[],
  columns = 5
) {
  return cells.map((cell, index) => ({
    column: (index % columns) + 1,
    index,
    itemId: cell.itemId,
    row: Math.floor(index / columns) + 1,
    surface: cell.surface
  }));
}

function uniqueSortedIndexes(indexes: readonly number[], totalItems: number) {
  return [
    ...new Set(
      indexes
        .map((index) => Math.round(index))
        .filter(
          (index) => Number.isFinite(index) && index >= 0 && index < totalItems
        )
    )
  ].sort((left, right) => left - right);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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

function isActivationTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "BUTTON" ||
    target.tagName === "A" ||
    target.getAttribute("role") === "button"
  );
}
