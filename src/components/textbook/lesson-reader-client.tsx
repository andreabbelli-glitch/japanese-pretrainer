"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";

import {
  setFuriganaModeAction,
  setLessonCompletionAction
} from "@/actions/textbook";
import { cx } from "@/lib/classnames";
import { applyLessonCompletionState } from "@/lib/textbook-reader-state";
import type {
  FuriganaMode,
  TextbookLessonData,
  TextbookTooltipEntry
} from "@/lib/textbook-types";
import {
  buildReviewSessionHref,
  mediaTextbookLessonTooltipsHref
} from "@/lib/site";

import {
  EntryTooltipCard,
  type ExpandedImageState,
  getTooltipEntryKey,
  LessonArticle,
  type TooltipTarget
} from "./lesson-article";
import {
  LessonRail,
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
  formatCrossMediaHintLabel
} from "./lesson-article";

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

const TOOLTIP_AUDIO_PRELOAD_DELAY_MS = 200;

function buildTooltipEntryMap(entries: TextbookTooltipEntry[]) {
  return new Map(
    entries.map((entry) => [getTooltipEntryKey(entry), entry] as const)
  );
}

export function LessonReaderClient({ data }: LessonReaderClientProps) {
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
  const [audioPreloadEntryKey, setAudioPreloadEntryKey] = useState<string | null>(
    null
  );
  const [isSavingFurigana, setIsSavingFurigana] = useState(false);
  const [isSavingLesson, startSavingLesson] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipRequestRef = useRef<Promise<void> | null>(null);
  const tooltipAbortRef = useRef<AbortController | null>(null);
  const currentLessonIdRef = useRef(data.lesson.id);
  const persistedFuriganaModeRef = useRef(data.furiganaMode);
  const queuedFuriganaModeRef = useRef<FuriganaMode | null>(null);
  const lessonStatus = readerData.lesson.status;

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
    anchorRef.current = null;
  }, [data]);

  useEffect(() => {
    persistedFuriganaModeRef.current = data.furiganaMode;
  }, [data.furiganaMode]);

  useEffect(() => {
    return () => {
      tooltipAbortRef.current?.abort();
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
    if (tooltipLoadState !== "idle") {
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
  }, [tooltipLoadState, ensureTooltipEntries]);

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

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedImage(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedImage]);

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

  const toggleLessonCompletion = () => {
    const wasCompleted = lessonStatus === "completed";
    const markAsCompleted = !wasCompleted;
    setReaderData((current) =>
      applyLessonCompletionState(current, markAsCompleted)
    );

    startSavingLesson(async () => {
      try {
        await setLessonCompletionAction({
          lessonId: readerData.lesson.id,
          mediaSlug: readerData.media.slug,
          lessonSlug: readerData.lesson.slug,
          completed: markAsCompleted
        });
      } catch {
        setReaderData((current) =>
          applyLessonCompletionState(current, wasCompleted)
        );
      }
    });
  };

  const openImage = (image: ExpandedImageState) => {
    clearCloseTimer();
    setTooltip(null);
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
        onOpenLessons={() => setMobileSheet({ type: "lessons" })}
        totalLessons={readerData.totalLessons}
      />

      <div className="reader-layout">
        <aside className="reader-rail">
          <LessonRail
            activeLessonId={readerData.lesson.id}
            groups={readerData.groups}
            mediaSlug={readerData.media.slug}
          />
        </aside>

        <main className="reader-main">
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
                )
                  ?.segmentId ?? null
            })}
          />
        </main>
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
        <MobileSheet onClose={() => setMobileSheet(null)}>
          {mobileSheet.type === "lessons" ? (
            <div className="reader-sheet__panel">
              <div className="reader-sheet__header">
                <p className="eyebrow">Lezioni</p>
                <h2 className="reader-sheet__title">Percorso del media</h2>
              </div>
              <LessonRail
                activeLessonId={readerData.lesson.id}
                compact
                groups={readerData.groups}
                mediaSlug={readerData.media.slug}
                onNavigate={() => setMobileSheet(null)}
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
          onClose={() => setExpandedImage(null)}
        />
      ) : null}
    </div>
  );
}
