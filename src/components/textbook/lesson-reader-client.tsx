"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";

import {
  recordLessonOpenedAction,
  setFuriganaModeAction,
  setLessonCompletionAction
} from "@/actions/textbook";
import {
  applyLessonCompletionState,
  applyLessonOpenedState,
  LESSON_OPEN_WRITE_THROTTLE_MS,
  type LessonOpenState
} from "@/features/textbook/client/reader-state";
import type {
  FuriganaMode,
  TextbookLessonData,
  TextbookTooltipEntry
} from "@/features/textbook/types";
import { cx } from "@/features/shared/ui/classnames";
import {
  buildReviewSessionHref,
  mediaTextbookLessonTooltipsHref
} from "@/features/navigation";

import {
  EntryTooltipCard,
  type ExpandedImageState,
  getTooltipEntryKey,
  hasLessonTooltipTargets,
  LessonArticle,
  type TooltipTarget
} from "./lesson-article";
import {
  MemoizedLessonRail,
  LessonReaderFooter,
  LessonReaderHeader,
  LessonReaderMobileStrip,
  MobileSheet,
  ReaderImageLightbox
} from "./lesson-reader-ui";
import {
  computeReaderTooltipPosition,
  READER_TOOLTIP_MAX_WIDTH_PX,
  READER_TOOLTIP_VIEWPORT_MARGIN_PX
} from "./tooltip-position";
export {
  LessonArticle,
  formatCrossMediaHintLabel,
  hasLessonTooltipTargets
} from "./lesson-article";
export { areLessonRailPropsEqual } from "./lesson-reader-ui";

type LessonReaderClientProps = {
  data: TextbookLessonData;
};

type TooltipState = {
  entryKey: string;
  locked: boolean;
  left: number;
  top: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

type MobileSheetState =
  | {
      type: "lessons";
    }
  | {
      type: "entry";
      entryKey: string;
    };

type TooltipLoadState = "idle" | "loading" | "loaded" | "error";

type LessonOpenAttempt = {
  attemptedAt: number;
  promise: Promise<LessonOpenState> | null;
  state: LessonOpenState | null;
};

const TOOLTIP_AUDIO_PRELOAD_DELAY_MS = 200;
const LESSON_OPEN_RETRY_DELAY_MS = 30_000;

function buildTooltipEntryMap(entries: TextbookTooltipEntry[]) {
  return new Map(
    entries.map((entry) => [getTooltipEntryKey(entry), entry] as const)
  );
}

function isLessonOpenAttemptWithinThrottle(
  attempt: LessonOpenAttempt,
  now: number
) {
  if (attempt.state) {
    const lastOpenedAt = Date.parse(attempt.state.lastOpenedAt);

    if (Number.isFinite(lastOpenedAt)) {
      return now - lastOpenedAt < LESSON_OPEN_WRITE_THROTTLE_MS;
    }
  }

  return now - attempt.attemptedAt < LESSON_OPEN_WRITE_THROTTLE_MS;
}

export function LessonReaderClient({ data }: LessonReaderClientProps) {
  const router = useRouter();
  const [readerData, setReaderData] = useState(data);
  const [furiganaMode, setFuriganaModeState] = useState<FuriganaMode>(
    data.furiganaMode
  );
  const [isTouchLayout, setIsTouchLayout] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetState | null>(null);
  const [expandedImage, setExpandedImage] = useState<ExpandedImageState | null>(
    null
  );
  const [entriesByKey, setEntriesByKey] = useState(() =>
    buildTooltipEntryMap(data.entries)
  );
  const [tooltipLoadState, setTooltipLoadState] = useState<TooltipLoadState>(
    data.entries.length > 0 ? "loaded" : "idle"
  );
  const [audioPreloadEntryKey, setAudioPreloadEntryKey] = useState<
    string | null
  >(null);
  const [isSavingFurigana, setIsSavingFurigana] = useState(false);
  const [lessonOpenRetryToken, setLessonOpenRetryToken] = useState(0);
  const [isSavingLesson, startSavingLesson] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipRequestRef = useRef<Promise<void> | null>(null);
  const tooltipAbortRef = useRef<AbortController | null>(null);
  const currentLessonIdRef = useRef(data.lesson.id);
  const isMountedRef = useRef(false);
  const imageLightboxOpenerRef = useRef<HTMLButtonElement | null>(null);
  const lessonOpenAttemptByIdRef = useRef(new Map<string, LessonOpenAttempt>());
  const lessonOpenRetryTimerRef = useRef<number | null>(null);
  const mobileSheetOpenerRef = useRef<HTMLElement | null>(null);
  const persistedFuriganaModeRef = useRef(data.furiganaMode);
  const serverFuriganaModeRef = useRef(data.furiganaMode);
  const queuedFuriganaModeRef = useRef<FuriganaMode | null>(null);
  const lessonStatus = readerData.lesson.status;
  const hasTooltipTargets = hasLessonTooltipTargets(readerData.lesson.ast);

  useEffect(() => {
    if (currentLessonIdRef.current === data.lesson.id) {
      return;
    }

    currentLessonIdRef.current = data.lesson.id;
    setReaderData(data);
    persistedFuriganaModeRef.current = data.furiganaMode;
    queuedFuriganaModeRef.current = null;
    setFuriganaModeState(data.furiganaMode);
    setIsSavingFurigana(false);
    tooltipAbortRef.current?.abort();
    tooltipAbortRef.current = null;
    tooltipRequestRef.current = null;
    setEntriesByKey(buildTooltipEntryMap(data.entries));
    setTooltipLoadState(data.entries.length > 0 ? "loaded" : "idle");
    setTooltip(null);
    setMobileSheet(null);
    mobileSheetOpenerRef.current = null;
    anchorRef.current = null;
  }, [data]);

  const applyOpenedStateIfCurrent = useCallback(
    (
      lessonId: string,
      lessonStatusAtRequestStart: TextbookLessonData["lesson"]["status"],
      openedState: LessonOpenState
    ) => {
      setReaderData((current) => {
        if (
          current.lesson.id !== lessonId ||
          current.lesson.status !== lessonStatusAtRequestStart ||
          (current.lesson.status === "completed" &&
            openedState.status !== "completed")
        ) {
          return current;
        }

        return applyLessonOpenedState(current, openedState);
      });
    },
    []
  );

  const scheduleLessonOpenRetry = useCallback((lessonId: string) => {
    if (!isMountedRef.current || currentLessonIdRef.current !== lessonId) {
      return;
    }

    if (lessonOpenRetryTimerRef.current !== null) {
      window.clearTimeout(lessonOpenRetryTimerRef.current);
    }

    lessonOpenRetryTimerRef.current = window.setTimeout(() => {
      lessonOpenRetryTimerRef.current = null;
      setLessonOpenRetryToken((current) => current + 1);
    }, LESSON_OPEN_RETRY_DELAY_MS);
  }, []);

  useEffect(() => {
    if (currentLessonIdRef.current !== data.lesson.id) {
      return;
    }

    setReaderData((current) => (current === data ? current : data));
  }, [data]);

  useEffect(() => {
    const lessonId = data.lesson.id;
    const lessonStatusAtRequestStart = data.lesson.status;
    const now = Date.now();
    const existingAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);
    const isWithinThrottle =
      existingAttempt !== undefined &&
      isLessonOpenAttemptWithinThrottle(existingAttempt, now);

    if (isWithinThrottle && existingAttempt.state) {
      applyOpenedStateIfCurrent(
        lessonId,
        lessonStatusAtRequestStart,
        existingAttempt.state
      );
      return;
    }

    let isCancelled = false;
    const attachOpenStateHandlers = (
      promise: Promise<LessonOpenState>,
      attemptedAt: number
    ) => {
      void promise
        .then((openedState) => {
          const currentAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);

          if (currentAttempt?.promise === promise) {
            lessonOpenAttemptByIdRef.current.set(lessonId, {
              attemptedAt,
              promise: null,
              state: openedState
            });
          }

          if (!isCancelled) {
            applyOpenedStateIfCurrent(
              lessonId,
              lessonStatusAtRequestStart,
              openedState
            );
          }
        })
        .catch(() => {
          const currentAttempt = lessonOpenAttemptByIdRef.current.get(lessonId);

          if (currentAttempt?.promise === promise) {
            lessonOpenAttemptByIdRef.current.delete(lessonId);
          }

          scheduleLessonOpenRetry(lessonId);
        });
    };

    if (isWithinThrottle && existingAttempt.promise) {
      attachOpenStateHandlers(
        existingAttempt.promise,
        existingAttempt.attemptedAt
      );

      return () => {
        isCancelled = true;
      };
    }

    const promise = recordLessonOpenedAction({ lessonId });

    lessonOpenAttemptByIdRef.current.set(lessonId, {
      attemptedAt: now,
      promise,
      state: null
    });
    attachOpenStateHandlers(promise, now);

    return () => {
      isCancelled = true;
    };
  }, [
    applyOpenedStateIfCurrent,
    data,
    data.lesson.id,
    data.lesson.status,
    lessonOpenRetryToken,
    scheduleLessonOpenRetry
  ]);

  useEffect(() => {
    const previousServerFuriganaMode = serverFuriganaModeRef.current;
    serverFuriganaModeRef.current = data.furiganaMode;
    persistedFuriganaModeRef.current = data.furiganaMode;

    if (
      currentLessonIdRef.current !== data.lesson.id ||
      previousServerFuriganaMode === data.furiganaMode
    ) {
      return;
    }

    setFuriganaModeState((current) =>
      current === data.furiganaMode ? current : data.furiganaMode
    );
  }, [data.furiganaMode, data.lesson.id]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      tooltipAbortRef.current?.abort();

      if (lessonOpenRetryTimerRef.current !== null) {
        window.clearTimeout(lessonOpenRetryTimerRef.current);
        lessonOpenRetryTimerRef.current = null;
      }
    };
  }, []);

  const activeTooltipEntryKey =
    tooltip?.entryKey ??
    (mobileSheet?.type === "entry" ? mobileSheet.entryKey : null);

  useEffect(() => {
    if (!activeTooltipEntryKey) {
      setAudioPreloadEntryKey(null);
      return;
    }

    setAudioPreloadEntryKey((current) =>
      current === activeTooltipEntryKey ? current : null
    );

    const timeoutId = window.setTimeout(() => {
      setAudioPreloadEntryKey(activeTooltipEntryKey);
    }, TOOLTIP_AUDIO_PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTooltipEntryKey]);

  useEffect(() => {
    const updateLayoutMode = () => {
      setIsTouchLayout(
        window.matchMedia(
          "(hover: none), (pointer: coarse), (max-width: 960px)"
        ).matches
      );
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const ensureTooltipEntries = useCallback(async () => {
    if (entriesByKey.size > 0 || tooltipLoadState === "loaded") {
      return;
    }

    if (tooltipRequestRef.current) {
      await tooltipRequestRef.current;
      return;
    }

    const controller = new AbortController();

    tooltipAbortRef.current?.abort();
    tooltipAbortRef.current = controller;
    setTooltipLoadState("loading");

    const request = (async () => {
      try {
        const response = await fetch(
          mediaTextbookLessonTooltipsHref(
            readerData.media.slug,
            readerData.lesson.slug
          ),
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(
            `Tooltip request failed with status ${response.status}.`
          );
        }

        const entries = (await response.json()) as TextbookTooltipEntry[];

        if (controller.signal.aborted) {
          return;
        }

        setEntriesByKey(buildTooltipEntryMap(entries));
        setTooltipLoadState("loaded");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Unable to load textbook tooltip entries.", error);
        setTooltipLoadState("error");
      } finally {
        if (tooltipAbortRef.current === controller) {
          tooltipAbortRef.current = null;
        }

        tooltipRequestRef.current = null;
      }
    })();

    tooltipRequestRef.current = request;
    await request;
  }, [
    entriesByKey,
    readerData.lesson.slug,
    readerData.media.slug,
    tooltipLoadState
  ]);

  // Prefetch tooltip entries during idle time so they're ready before the
  // user's first hover/tap.
  useEffect(() => {
    if (tooltipLoadState !== "idle" || !hasTooltipTargets) {
      return;
    }

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 150);

    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const id = schedule(() => {
      ensureTooltipEntries();
    });

    return () => {
      cancel(id);
    };
  }, [hasTooltipTargets, tooltipLoadState, ensureTooltipEntries]);

  const recomputeTooltipPosition = useCallback(() => {
    if (!anchorRef.current) {
      return;
    }

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const nextPosition = computeReaderTooltipPosition({
      anchorRect,
      tooltipSize: {
        width:
          tooltipRect?.width ??
          Math.min(
            READER_TOOLTIP_MAX_WIDTH_PX,
            Math.max(
              0,
              window.innerWidth - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
            )
          ),
        height: tooltipRect?.height ?? 0
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    setTooltip((current) =>
      current
        ? current.left === nextPosition.left &&
          current.top === nextPosition.top &&
          current.placement === nextPosition.placement &&
          current.maxHeight === nextPosition.maxHeight
          ? current
          : {
              ...current,
              ...nextPosition
            }
        : current
    );
  }, []);

  useEffect(() => {
    if (!tooltip) {
      return;
    }

    const tooltipElement = tooltipRef.current;
    const handleViewportChange = () => {
      recomputeTooltipPosition();
    };

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !tooltipElement
        ? null
        : new ResizeObserver(() => {
            handleViewportChange();
          });
    if (tooltipElement) {
      resizeObserver?.observe(tooltipElement);
    }
    handleViewportChange();

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
      resizeObserver?.disconnect();
    };
  }, [recomputeTooltipPosition, tooltip]);

  useEffect(() => {
    if (!tooltip?.locked) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        tooltipRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }

      setTooltip(null);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [tooltip]);

  useEffect(() => {
    document.body.style.overflow = mobileSheet || expandedImage ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [expandedImage, mobileSheet]);

  const closeTooltipSoon = () => {
    if (tooltip?.locked) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setTooltip((current) => (current?.locked ? current : null));
    }, 100);
  };

  const openReference = (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => {
    const entryKey = getTooltipEntryKey(target);

    clearCloseTimer();
    void ensureTooltipEntries();

    if (isTouchLayout) {
      // Restoring focus after closing the sheet must not immediately reopen it.
      // Keyboard activation still emits a click, so focus alone is not the
      // activation gesture on touch layouts.
      if (intent === "focus") {
        return;
      }

      mobileSheetOpenerRef.current = element;
      setMobileSheet({
        type: "entry",
        entryKey
      });
      setTooltip(null);
      return;
    }

    anchorRef.current = element;
    const nextPosition = computeReaderTooltipPosition({
      anchorRect: element.getBoundingClientRect(),
      tooltipSize: {
        width: Math.min(
          READER_TOOLTIP_MAX_WIDTH_PX,
          Math.max(0, window.innerWidth - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2)
        ),
        height: 0
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    setTooltip((current) => {
      if (
        current &&
        current.entryKey === entryKey &&
        current.locked &&
        intent === "click"
      ) {
        return null;
      }

      return {
        entryKey,
        locked: intent === "click",
        ...nextPosition
      };
    });
  };

  const flushFuriganaModeChange = useCallback(
    async (nextMode: FuriganaMode) => {
      let targetMode = nextMode;

      setIsSavingFurigana(true);

      while (true) {
        try {
          await setFuriganaModeAction({
            mediaSlug: readerData.media.slug,
            lessonSlug: readerData.lesson.slug,
            mode: targetMode
          });
          persistedFuriganaModeRef.current = targetMode;
        } catch {
          queuedFuriganaModeRef.current = null;
          setFuriganaModeState(persistedFuriganaModeRef.current);
          setIsSavingFurigana(false);
          return;
        }

        const queuedMode = queuedFuriganaModeRef.current;

        if (!queuedMode || queuedMode === targetMode) {
          queuedFuriganaModeRef.current = null;
          setIsSavingFurigana(false);
          return;
        }

        targetMode = queuedMode;
      }
    },
    [readerData.lesson.slug, readerData.media.slug]
  );

  const handleFuriganaModeChange = (nextMode: FuriganaMode) => {
    if (nextMode === furiganaMode) {
      return;
    }

    setFuriganaModeState(nextMode);

    if (isSavingFurigana) {
      queuedFuriganaModeRef.current = nextMode;
      return;
    }

    void flushFuriganaModeChange(nextMode);
  };
  const handleCloseLessonSheet = useCallback(() => {
    setMobileSheet(null);
  }, []);
  const handleCloseExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);

  const toggleLessonCompletion = () => {
    const wasCompleted = lessonStatus === "completed";
    const markAsCompleted = !wasCompleted;

    lessonOpenAttemptByIdRef.current.delete(readerData.lesson.id);
    setReaderData((current) =>
      applyLessonCompletionState(current, markAsCompleted)
    );

    startSavingLesson(async () => {
      try {
        const result = await setLessonCompletionAction({
          lessonId: readerData.lesson.id,
          mediaSlug: readerData.media.slug,
          lessonSlug: readerData.lesson.slug,
          completed: markAsCompleted
        });

        if (markAsCompleted && result.consolidationHref) {
          router.push(result.consolidationHref);
        }
      } catch {
        lessonOpenAttemptByIdRef.current.delete(readerData.lesson.id);
        setReaderData((current) =>
          applyLessonCompletionState(current, wasCompleted)
        );
      }
    });
  };

  const openImage = (image: ExpandedImageState, opener: HTMLButtonElement) => {
    clearCloseTimer();
    setTooltip(null);
    imageLightboxOpenerRef.current = opener;
    setExpandedImage(image);
  };
  const tooltipEntry = tooltip
    ? (entriesByKey.get(tooltip.entryKey) ?? null)
    : null;
  const mobileSheetEntry =
    mobileSheet?.type === "entry"
      ? (entriesByKey.get(mobileSheet.entryKey) ?? null)
      : null;
  const tooltipStyle = tooltip
    ? ({
        left: `${tooltip.left}px`,
        top: `${tooltip.top}px`,
        "--reader-tooltip-max-height": `${tooltip.maxHeight}px`
      } satisfies CSSProperties & Record<"--reader-tooltip-max-height", string>)
    : undefined;

  return (
    <div className="reader-page" data-furigana-mode={furiganaMode}>
      <LessonReaderHeader
        completedLessons={readerData.completedLessons}
        furiganaMode={furiganaMode}
        isSavingFurigana={isSavingFurigana}
        isSavingLesson={isSavingLesson}
        lesson={readerData.lesson}
        lessonStatus={lessonStatus}
        media={readerData.media}
        onFuriganaModeChange={handleFuriganaModeChange}
        onToggleLessonCompletion={toggleLessonCompletion}
        totalLessons={readerData.totalLessons}
      />

      <LessonReaderMobileStrip
        completedLessons={readerData.completedLessons}
        furiganaMode={furiganaMode}
        onOpenLessons={(opener) => {
          mobileSheetOpenerRef.current = opener;
          setMobileSheet({ type: "lessons" });
        }}
        totalLessons={readerData.totalLessons}
      />

      <div className="reader-layout">
        <aside className="reader-rail">
          <MemoizedLessonRail
            activeLessonId={readerData.lesson.id}
            groups={readerData.groups}
            mediaSlug={readerData.media.slug}
          />
        </aside>

        <div className="reader-main">
          <section className="reader-article-card">
            <div className="reader-article-intro">
              <p className="reader-article-intro__summary">
                {readerData.lesson.summary ??
                  readerData.lesson.excerpt ??
                  "La lettura resta al centro: chiarimenti contestuali e progressi minimi ma reali."}
              </p>
            </div>

            <LessonArticle
              activeEntryKey={tooltip?.entryKey ?? null}
              document={readerData.lesson.ast}
              furiganaMode={furiganaMode}
              isTouchLayout={isTouchLayout}
              lessonTitle={readerData.lesson.title}
              mediaSlug={readerData.media.slug}
              onReferenceBlur={closeTooltipSoon}
              onReferenceClick={openReference}
              onReferenceFocus={openReference}
              onReferenceHover={openReference}
              onReferenceLeave={closeTooltipSoon}
              onImageExpand={openImage}
            />
          </section>

          <LessonReaderFooter
            isSavingLesson={isSavingLesson}
            lessonStatus={lessonStatus}
            mediaSlug={readerData.media.slug}
            nextLesson={readerData.nextLesson}
            onToggleLessonCompletion={toggleLessonCompletion}
            previousLesson={readerData.previousLesson}
            reviewHref={buildReviewSessionHref({
              mediaSlug: readerData.media.slug,
              segmentId:
                readerData.lessons.find(
                  (lesson) => lesson.id === readerData.lesson.id
                )?.segmentId ?? null
            })}
          />
        </div>
      </div>

      {tooltip ? (
        <div
          className={cx(
            "reader-tooltip",
            tooltip.placement === "top" && "reader-tooltip--top"
          )}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closeTooltipSoon}
          ref={tooltipRef}
          style={tooltipStyle}
        >
          <EntryTooltipCard
            entry={tooltipEntry}
            audioPreload={
              audioPreloadEntryKey === tooltip.entryKey ? "auto" : "none"
            }
            isLoading={tooltipLoadState === "loading" && !tooltipEntry}
            onRetry={
              tooltipLoadState === "error"
                ? () => {
                    void ensureTooltipEntries();
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {mobileSheet ? (
        <MobileSheet
          ariaLabel={
            mobileSheet.type === "lessons"
              ? "Percorso delle lesson"
              : "Dettagli del riferimento"
          }
          onClose={handleCloseLessonSheet}
          returnFocusTo={mobileSheetOpenerRef.current}
        >
          {mobileSheet.type === "lessons" ? (
            <div className="reader-sheet__panel">
              <div className="reader-sheet__header">
                <p className="eyebrow">Lezioni</p>
                <h2 className="reader-sheet__title">Percorso del media</h2>
              </div>
              <MemoizedLessonRail
                activeLessonId={readerData.lesson.id}
                compact
                groups={readerData.groups}
                mediaSlug={readerData.media.slug}
                onNavigate={handleCloseLessonSheet}
              />
            </div>
          ) : (
            <EntryTooltipCard
              entry={mobileSheetEntry}
              audioPreload={
                audioPreloadEntryKey === mobileSheet.entryKey ? "auto" : "none"
              }
              isLoading={tooltipLoadState === "loading" && !mobileSheetEntry}
              mobile
              onRetry={
                tooltipLoadState === "error"
                  ? () => {
                      void ensureTooltipEntries();
                    }
                  : undefined
              }
            />
          )}
        </MobileSheet>
      ) : null}

      {expandedImage ? (
        <ReaderImageLightbox
          image={expandedImage}
          onClose={handleCloseExpandedImage}
          returnFocusTo={imageLightboxOpenerRef.current}
        />
      ) : null}
    </div>
  );
}
