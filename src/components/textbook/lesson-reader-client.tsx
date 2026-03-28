"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  startTransition,
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
import type {
  FuriganaMode,
  TextbookLessonData,
  TextbookLessonNavItem,
  TextbookTooltipEntry
} from "@/lib/textbook";
import {
  mediaStudyHref,
  mediaTextbookLessonHref,
  mediaTextbookLessonTooltipsHref
} from "@/lib/site";

import {
  EntryTooltipCard,
  type ExpandedImageState,
  getTooltipEntryKey,
  LessonArticle,
  type TooltipTarget
} from "./lesson-article";
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
  const router = useRouter();
  const [furiganaMode, setFuriganaModeState] = useState<FuriganaMode>(
    data.furiganaMode
  );
  const [lessonStatus, setLessonStatus] = useState(data.lesson.status);
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
  const [isSavingFurigana, startSavingFurigana] = useTransition();
  const [isSavingLesson, startSavingLesson] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipRequestRef = useRef<Promise<void> | null>(null);
  const tooltipAbortRef = useRef<AbortController | null>(null);
  const currentLessonIdRef = useRef(data.lesson.id);

  useEffect(() => {
    if (currentLessonIdRef.current === data.lesson.id) {
      return;
    }

    currentLessonIdRef.current = data.lesson.id;
    tooltipAbortRef.current?.abort();
    tooltipAbortRef.current = null;
    tooltipRequestRef.current = null;
    setEntriesByKey(buildTooltipEntryMap(data.entries));
    setTooltipLoadState(data.entries.length > 0 ? "loaded" : "idle");
    setTooltip(null);
    setMobileSheet(null);
    anchorRef.current = null;
  }, [data.entries, data.lesson.id]);

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
          mediaTextbookLessonTooltipsHref(data.media.slug, data.lesson.slug),
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
  }, [data.lesson.slug, data.media.slug, entriesByKey, tooltipLoadState]);

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

  const recomputeTooltipPosition = () => {
    if (!anchorRef.current) {
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const width = 320;
    const margin = 18;
    const left = Math.max(
      margin,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - margin
      )
    );
    const preferTop = rect.bottom > window.innerHeight * 0.62;
    const top = preferTop ? rect.top - 14 : rect.bottom + 14;

    setTooltip((current) =>
      current
        ? {
            ...current,
            left,
            top,
            placement: preferTop ? "top" : "bottom"
          }
        : current
    );
  };

  useEffect(() => {
    if (!tooltip) {
      return;
    }

    const handleViewportChange = () => {
      recomputeTooltipPosition();
    };

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [tooltip]);

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
    const rect = element.getBoundingClientRect();
    const width = 320;
    const margin = 18;
    const left = Math.max(
      margin,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - margin
      )
    );
    const preferTop = rect.bottom > window.innerHeight * 0.62;
    const top = preferTop ? rect.top - 14 : rect.bottom + 14;

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
        left,
        top,
        placement: preferTop ? "top" : "bottom"
      };
    });
  };

  const handleFuriganaModeChange = (nextMode: FuriganaMode) => {
    const previousMode = furiganaMode;
    setFuriganaModeState(nextMode);

    startSavingFurigana(async () => {
      try {
        await setFuriganaModeAction({
          mediaSlug: data.media.slug,
          lessonSlug: data.lesson.slug,
          mode: nextMode
        });
      } catch {
        setFuriganaModeState(previousMode);
      }
    });
  };

  const toggleLessonCompletion = () => {
    const markAsCompleted = lessonStatus !== "completed";
    setLessonStatus(markAsCompleted ? "completed" : "in_progress");

    startSavingLesson(async () => {
      try {
        await setLessonCompletionAction({
          lessonId: data.lesson.id,
          mediaSlug: data.media.slug,
          lessonSlug: data.lesson.slug,
          completed: markAsCompleted
        });
        startTransition(() => {
          router.refresh();
        });
      } catch {
        setLessonStatus(data.lesson.status);
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

  return (
    <div className="reader-page" data-furigana-mode={furiganaMode}>
      <header className="reader-study-header">
        <div className="reader-study-header__left">
          <Link
            className="reader-study-header__back"
            href={mediaStudyHref(data.media.slug, "textbook")}
          >
            {data.media.title} / Textbook
          </Link>
          <div className="reader-study-header__copy">
            <p className="eyebrow">{data.lesson.segmentTitle}</p>
            <h1 className="reader-study-header__title">{data.lesson.title}</h1>
            <div className="reader-study-header__meta">
              <span>
                {data.completedLessons}/{data.totalLessons} lette
              </span>
              <span>
                {lessonStatus === "completed"
                  ? "Completata"
                  : data.lesson.statusLabel}
              </span>
              {data.lesson.difficulty ? (
                <span>{data.lesson.difficulty}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="reader-study-header__actions">
          <FuriganaModeControl
            currentMode={furiganaMode}
            disabled={isSavingFurigana}
            onChange={handleFuriganaModeChange}
          />
          <button
            className={cx(
              "button",
              lessonStatus === "completed" ? "button--ghost" : "button--primary"
            )}
            disabled={isSavingLesson}
            onClick={toggleLessonCompletion}
            type="button"
          >
            {lessonStatus === "completed"
              ? "Segna in corso"
              : "Segna completata"}
          </button>
        </div>
      </header>

      <div className="reader-mobile-strip">
        <button
          className="button button--ghost reader-mobile-strip__button"
          onClick={() => setMobileSheet({ type: "lessons" })}
          type="button"
        >
          Lezioni
        </button>
        <div className="reader-mobile-strip__status">
          <span>
            {data.completedLessons}/{data.totalLessons} lette
          </span>
          <span>Furigana: {furiganaMode}</span>
        </div>
      </div>

      <div className="reader-layout">
        <aside className="reader-rail">
          <LessonRail
            activeLessonId={data.lesson.id}
            groups={data.groups}
            mediaSlug={data.media.slug}
          />
        </aside>

        <main className="reader-main">
          <section className="reader-article-card">
            <div className="reader-article-intro">
              <p className="reader-article-intro__summary">
                {data.lesson.summary ??
                  data.lesson.excerpt ??
                  "La lettura resta al centro: chiarimenti contestuali e progressi minimi ma reali."}
              </p>
            </div>

            <LessonArticle
              activeEntryKey={tooltip?.entryKey ?? null}
              document={data.lesson.ast}
              furiganaMode={furiganaMode}
              isTouchLayout={isTouchLayout}
              mediaSlug={data.media.slug}
              onReferenceBlur={closeTooltipSoon}
              onReferenceClick={openReference}
              onReferenceFocus={openReference}
              onReferenceHover={openReference}
              onReferenceLeave={closeTooltipSoon}
              onImageExpand={openImage}
            />
          </section>

          <footer className="reader-footer">
            <div className="reader-footer__nav">
              {data.previousLesson ? (
                <LessonNavLink
                  direction="prev"
                  lesson={data.previousLesson}
                  mediaSlug={data.media.slug}
                />
              ) : (
                <div className="reader-footer__placeholder" />
              )}
              {data.nextLesson ? (
                <LessonNavLink
                  direction="next"
                  lesson={data.nextLesson}
                  mediaSlug={data.media.slug}
                />
              ) : (
                <div className="reader-footer__placeholder" />
              )}
            </div>

            <button
              className={cx(
                "button",
                lessonStatus === "completed"
                  ? "button--ghost"
                  : "button--primary"
              )}
              disabled={isSavingLesson}
              onClick={toggleLessonCompletion}
              type="button"
            >
              {lessonStatus === "completed" ? "Riapri lesson" : "Chiudi lesson"}
            </button>
          </footer>
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
          style={
            {
              left: `${tooltip.left}px`,
              top: `${tooltip.top}px`
            } satisfies CSSProperties
          }
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
                activeLessonId={data.lesson.id}
                compact
                groups={data.groups}
                mediaSlug={data.media.slug}
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

type FuriganaModeControlProps = {
  currentMode: FuriganaMode;
  disabled: boolean;
  onChange: (mode: FuriganaMode) => void;
};

function FuriganaModeControl({
  currentMode,
  disabled,
  onChange
}: FuriganaModeControlProps) {
  const options: Array<{ mode: FuriganaMode; label: string }> = [
    { mode: "off", label: "Nascoste" },
    { mode: "hover", label: "Al passaggio" },
    { mode: "on", label: "Sempre" }
  ];

  return (
    <div
      aria-label="Controllo furigana"
      className="reader-furigana-control"
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.mode}
          aria-pressed={currentMode === option.mode}
          className={cx(
            "reader-furigana-control__button",
            currentMode === option.mode &&
              "reader-furigana-control__button--active"
          )}
          disabled={disabled}
          onClick={() => onChange(option.mode)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type LessonRailProps = {
  activeLessonId: string;
  compact?: boolean;
  groups: TextbookLessonData["groups"];
  mediaSlug: string;
  onNavigate?: () => void;
};

function LessonRail({
  activeLessonId,
  compact = false,
  groups,
  mediaSlug,
  onNavigate
}: LessonRailProps) {
  return (
    <div
      className={cx(
        "reader-rail__card",
        compact && "reader-rail__card--compact"
      )}
    >
      {groups.map((group) => (
        <section key={group.id} className="reader-rail__group">
          <div className="reader-rail__group-heading">
            <p className="eyebrow">{group.title}</p>
            <span className="meta-pill">
              {group.completedLessons}/{group.totalLessons}
            </span>
          </div>
          <div className="reader-rail__list">
            {group.lessons.map((lesson) => (
              <Link
                key={lesson.id}
                className={cx(
                  "reader-rail__item",
                  lesson.id === activeLessonId && "reader-rail__item--active"
                )}
                href={mediaTextbookLessonHref(mediaSlug, lesson.slug)}
                onClick={onNavigate}
              >
                <div className="reader-rail__item-top">
                  <strong>{lesson.title}</strong>
                  <span className={`meta-pill meta-pill--${lesson.status}`}>
                    {lesson.statusLabel}
                  </span>
                </div>
                <p className="reader-rail__item-copy">
                  {lesson.summary ?? lesson.excerpt ?? lesson.segmentTitle}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type LessonNavLinkProps = {
  direction: "prev" | "next";
  lesson: TextbookLessonNavItem;
  mediaSlug: string;
};

function LessonNavLink({ direction, lesson, mediaSlug }: LessonNavLinkProps) {
  return (
    <Link
      className={cx(
        "reader-footer__link",
        direction === "next" && "reader-footer__link--next"
      )}
      href={mediaTextbookLessonHref(mediaSlug, lesson.slug)}
    >
      <span className="reader-footer__label">
        {direction === "prev" ? "Lesson precedente" : "Lesson successiva"}
      </span>
      <strong>{lesson.title}</strong>
    </Link>
  );
}

type MobileSheetProps = {
  children: ReactNode;
  onClose: () => void;
};

function MobileSheet({ children, onClose }: MobileSheetProps) {
  return (
    <div className="reader-sheet" role="dialog" aria-modal="true">
      <button
        aria-label="Chiudi pannello"
        className="reader-sheet__backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="reader-sheet__surface">
        <div className="reader-sheet__handle" />
        <button className="reader-sheet__close" onClick={onClose} type="button">
          Chiudi
        </button>
        {children}
      </div>
    </div>
  );
}

type ReaderImageLightboxProps = {
  image: ExpandedImageState;
  onClose: () => void;
};

function ReaderImageLightbox({ image, onClose }: ReaderImageLightboxProps) {
  const caption = image.captionText ?? image.alt;

  return (
    <div
      aria-label="Immagine ingrandita"
      aria-modal="true"
      className="reader-image-lightbox"
      role="dialog"
    >
      <button
        aria-label="Chiudi immagine"
        className="reader-image-lightbox__backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="reader-image-lightbox__surface">
        <div className="reader-image-lightbox__top">
          <p className="eyebrow">Immagine</p>
          <button
            autoFocus
            className="button button--ghost button--small"
            onClick={onClose}
            type="button"
          >
            Chiudi
          </button>
        </div>
        <div className="reader-image-lightbox__frame">
          <Image
            alt={image.alt}
            className="reader-image-lightbox__asset"
            decoding="async"
            height={image.presentation.height}
            loading="eager"
            sizes="100vw"
            src={image.src}
            unoptimized
            width={image.presentation.width}
          />
        </div>
        <p className="reader-image-lightbox__caption">{caption}</p>
      </div>
    </div>
  );
}
