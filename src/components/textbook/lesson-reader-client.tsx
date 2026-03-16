"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
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
import { renderFurigana } from "@/lib/render-furigana";
import type {
  ContentBlock,
  InlineNode,
  MarkdownDocument
} from "@/lib/content/types";
import type {
  FuriganaMode,
  TextbookLessonData,
  TextbookLessonNavItem,
  TextbookTooltipEntry
} from "@/lib/textbook";
import {
  mediaAssetHref,
  mediaStudyHref,
  mediaTextbookLessonHref,
  mediaTextbookLessonTooltipsHref
} from "@/lib/site";

import { PronunciationAudio } from "../ui/pronunciation-audio";

type LessonReaderClientProps = {
  data: TextbookLessonData;
};

type TooltipTarget = {
  id: string;
  kind: TextbookTooltipEntry["kind"];
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

type ImagePresentation = {
  height: number;
  sizes: string;
  variantClassName: string;
  width: number;
};

type ExpandedImageState = {
  alt: string;
  captionText: string | null;
  presentation: ImagePresentation;
  src: string;
};

function resolveImagePresentation(src: string): ImagePresentation {
  if (src.startsWith("assets/cards/")) {
    return {
      height: 908,
      sizes: "(max-width: 960px) min(100vw - 3rem, 24rem), 26rem",
      variantClassName: "reader-image--card",
      width: 650
    };
  }

  if (src.startsWith("assets/ui/")) {
    return {
      height: 900,
      sizes: "(max-width: 960px) 100vw, 56rem",
      variantClassName: "reader-image--ui",
      width: 1600
    };
  }

  return {
    height: 1000,
    sizes: "(max-width: 960px) 100vw, 48rem",
    variantClassName: "reader-image--default",
    width: 1400
  };
}

function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "furigana":
          return node.base;
        case "reference":
        case "emphasis":
        case "strong":
        case "inlineCode":
        case "link":
          return extractInlineText(node.children);
        case "break":
          return " ";
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function getTooltipEntryKey(target: TooltipTarget) {
  return `${target.kind}:${target.id}`;
}

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
              fallbackHtml={data.lesson.htmlRendered}
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

type LessonArticleProps = {
  activeEntryKey: string | null;
  document: MarkdownDocument | null;
  fallbackHtml: string | null;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  mediaSlug: string;
  onReferenceBlur: () => void;
  onReferenceClick: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceFocus: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceHover: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceLeave: () => void;
  onImageExpand: (image: ExpandedImageState) => void;
};

export function LessonArticle({
  activeEntryKey,
  document,
  fallbackHtml,
  furiganaMode,
  isTouchLayout,
  mediaSlug,
  onReferenceBlur,
  onReferenceClick,
  onReferenceFocus,
  onReferenceHover,
  onReferenceLeave,
  onImageExpand
}: LessonArticleProps) {
  if (!document) {
    return (
      <FallbackHtmlArticle
        activeEntryKey={activeEntryKey}
        fallbackHtml={fallbackHtml}
        furiganaMode={furiganaMode}
        isTouchLayout={isTouchLayout}
        onReferenceBlur={onReferenceBlur}
        onReferenceClick={onReferenceClick}
        onReferenceFocus={onReferenceFocus}
        onReferenceHover={onReferenceHover}
        onReferenceLeave={onReferenceLeave}
        onImageExpand={onImageExpand}
      />
    );
  }

  const renderInlineNodes = (nodes: InlineNode[]): ReactNode =>
    nodes.map((node, index) => {
      switch (node.type) {
        case "text":
          return <Fragment key={index}>{node.value}</Fragment>;
        case "furigana":
          return (
            <FuriganaRuby
              base={node.base}
              furiganaMode={furiganaMode}
              isTouchLayout={isTouchLayout}
              key={index}
              reading={node.reading}
            />
          );
        case "reference": {
          const target = {
            id: node.targetId,
            kind: node.targetType
          } satisfies TooltipTarget;

          return (
            <ReferenceToken
              active={activeEntryKey === getTooltipEntryKey(target)}
              kind={target.kind}
              key={index}
              onBlur={onReferenceBlur}
              onClick={onReferenceClick}
              onFocus={onReferenceFocus}
              onHover={onReferenceHover}
              onLeave={onReferenceLeave}
              target={target}
            >
              {renderInlineNodes(node.children)}
            </ReferenceToken>
          );
        }
        case "emphasis":
          return <em key={index}>{renderInlineNodes(node.children)}</em>;
        case "strong":
          return (
            <strong key={index}>{renderInlineNodes(node.children)}</strong>
          );
        case "inlineCode":
          return <code key={index}>{renderInlineNodes(node.children)}</code>;
        case "link":
          return (
            <a href={node.url} key={index} title={node.title ?? undefined}>
              {renderInlineNodes(node.children)}
            </a>
          );
        case "break":
          return <br key={index} />;
      }
    });

  const renderBlocks = (blocks: ContentBlock[]) =>
    blocks.map((block, index) => renderBlock(block, index));

  const renderBlock = (block: ContentBlock, index: number): ReactNode => {
    switch (block.type) {
      case "paragraph":
        return (
          <p className="reader-paragraph" key={index}>
            {renderInlineNodes(block.children)}
          </p>
        );
      case "heading":
        return block.depth === 1 ? (
          <h2 className="reader-heading reader-heading--h1" key={index}>
            {renderInlineNodes(block.children)}
          </h2>
        ) : block.depth === 2 ? (
          <h3 className="reader-heading reader-heading--h2" key={index}>
            {renderInlineNodes(block.children)}
          </h3>
        ) : (
          <h4 className="reader-heading reader-heading--h3" key={index}>
            {renderInlineNodes(block.children)}
          </h4>
        );
      case "list":
        return block.ordered ? (
          <ol className="reader-list reader-list--ordered" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.children)}</li>
            ))}
          </ol>
        ) : (
          <ul className="reader-list" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.children)}</li>
            ))}
          </ul>
        );
      case "blockquote":
        return (
          <blockquote className="reader-blockquote" key={index}>
            {renderBlocks(block.children)}
          </blockquote>
        );
      case "code":
        return (
          <pre className="reader-code" key={index}>
            <code>{block.value}</code>
          </pre>
        );
      case "thematicBreak":
        return <hr className="reader-divider" key={index} />;
      case "image":
        const imagePresentation = resolveImagePresentation(block.src);
        const imageTarget = block.cardId
          ? ({
              id: block.cardId,
              kind: "card"
            } satisfies TooltipTarget)
          : null;
        const expandedImage = {
          alt: block.alt,
          captionText: block.caption
            ? extractInlineText(block.caption.nodes)
            : null,
          presentation: imagePresentation,
          src: mediaAssetHref(mediaSlug, block.src)
        } satisfies ExpandedImageState;

        return (
          <figure
            className={cx(
              "reader-image",
              imagePresentation.variantClassName,
              !imageTarget && "reader-image--zoomable",
              imageTarget && "reader-image--interactive",
              imageTarget &&
                activeEntryKey === getTooltipEntryKey(imageTarget) &&
                "reader-image--active"
            )}
            data-card-id={block.cardId ?? undefined}
            key={index}
          >
            {imageTarget ? (
              <button
                className="reader-image__button"
                onBlur={onReferenceBlur}
                onClick={(event) => {
                  onReferenceClick(imageTarget, event.currentTarget, "click");
                }}
                onFocus={(event) => {
                  onReferenceFocus(imageTarget, event.currentTarget, "focus");
                }}
                onMouseEnter={(event) => {
                  onReferenceHover(imageTarget, event.currentTarget, "hover");
                }}
                onMouseLeave={onReferenceLeave}
                type="button"
              >
                <span className="reader-image__hint">Card</span>
                <Image
                  alt={block.alt}
                  className="reader-image__asset"
                  decoding="async"
                  height={imagePresentation.height}
                  loading="lazy"
                  sizes={imagePresentation.sizes}
                  src={mediaAssetHref(mediaSlug, block.src)}
                  unoptimized
                  width={imagePresentation.width}
                />
              </button>
            ) : (
              <button
                aria-label={`Apri immagine ingrandita: ${block.alt}`}
                className="reader-image__button reader-image__button--zoom"
                onClick={() => onImageExpand(expandedImage)}
                type="button"
              >
                <Image
                  alt={block.alt}
                  className="reader-image__asset"
                  decoding="async"
                  height={imagePresentation.height}
                  loading="lazy"
                  sizes={imagePresentation.sizes}
                  src={mediaAssetHref(mediaSlug, block.src)}
                  unoptimized
                  width={imagePresentation.width}
                />
              </button>
            )}
            {block.caption ? (
              <figcaption className="reader-image__caption">
                {renderInlineNodes(block.caption.nodes)}
              </figcaption>
            ) : null}
          </figure>
        );
      case "exampleSentence":
        return (
          <section className="reader-example-sentence" key={index}>
            <p className="reader-example-sentence__jp jp-inline">
              {renderInlineNodes(block.sentence.nodes)}
            </p>
            <details className="reader-example-sentence__translation">
              <summary>Mostra traduzione italiana</summary>
              <div className="reader-example-sentence__translation-body">
                <p>{renderInlineNodes(block.translationIt.nodes)}</p>
              </div>
            </details>
          </section>
        );
      case "termDefinition":
        return (
          <section className="reader-definition-card" key={index}>
            <div className="reader-definition-card__eyebrow">
              <span className="chip">Termine</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">
              {block.entry.lemma}
            </h3>
            <p className="reader-definition-card__reading jp-inline">
              {block.entry.reading} · {block.entry.romaji}
            </p>
            <p className="reader-definition-card__meaning">
              {block.entry.meaningIt}
            </p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">
                {renderInlineNodes(block.entry.notesIt.nodes)}
              </p>
            ) : null}
          </section>
        );
      case "grammarDefinition":
        return (
          <section
            className="reader-definition-card reader-definition-card--grammar"
            key={index}
          >
            <div className="reader-definition-card__eyebrow">
              <span className="chip chip--grammar">Grammatica</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">
              {block.entry.pattern}
            </h3>
            <p className="reader-definition-card__meaning">
              {block.entry.meaningIt}
            </p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">
                {renderInlineNodes(block.entry.notesIt.nodes)}
              </p>
            ) : null}
          </section>
        );
      case "cardDefinition":
        return (
          <section className="reader-card-inline" key={index}>
            <div className="reader-card-inline__face">
              <span className="eyebrow">Fronte</span>
              <div>{renderInlineNodes(block.card.front.nodes)}</div>
            </div>
            <div className="reader-card-inline__face reader-card-inline__face--back">
              <span className="eyebrow">Retro</span>
              <div>{renderInlineNodes(block.card.back.nodes)}</div>
            </div>
          </section>
        );
    }
  };

  return (
    <article className="reader-article">
      {renderBlocks(document.blocks)}
    </article>
  );
}

export function formatCrossMediaHintLabel(otherMediaCount: number) {
  return otherMediaCount === 1
    ? "Compare anche in 1 altro media."
    : `Compare anche in altri ${otherMediaCount} media.`;
}

type FallbackHtmlArticleProps = {
  activeEntryKey: string | null;
  fallbackHtml: string | null;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  onReferenceBlur: () => void;
  onReferenceClick: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceFocus: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceHover: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceLeave: () => void;
  onImageExpand: (image: ExpandedImageState) => void;
};

function FallbackHtmlArticle({
  activeEntryKey,
  fallbackHtml,
  furiganaMode,
  isTouchLayout,
  onReferenceBlur,
  onReferenceClick,
  onReferenceFocus,
  onReferenceHover,
  onReferenceLeave,
  onImageExpand
}: FallbackHtmlArticleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const html = fallbackHtml ?? "";

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const referenceSelector =
      ".content-entry-ref[data-entry-type][data-entry-id]";
    const imageSelector = ".reader-image[data-card-id]";
    const zoomableImageSelector = ".reader-image[data-image-src]";
    const references = Array.from(
      container.querySelectorAll<HTMLElement>(referenceSelector)
    );
    const images = Array.from(
      container.querySelectorAll<HTMLElement>(imageSelector)
    );
    const zoomableImages = Array.from(
      container.querySelectorAll<HTMLElement>(zoomableImageSelector)
    );
    const rubies = Array.from(container.querySelectorAll<HTMLElement>("ruby"));

    const resolveEntryTarget = (element: HTMLElement) => {
      const entryType = element.dataset.entryType;
      const entryId = element.dataset.entryId;

      if (
        (entryType !== "term" && entryType !== "grammar") ||
        typeof entryId !== "string"
      ) {
        return null;
      }

      return {
        id: entryId,
        kind: entryType
      } satisfies TooltipTarget;
    };
    const resolveImageEntryTarget = (element: HTMLElement) => {
      const cardId = element.dataset.cardId;

      return typeof cardId === "string"
        ? ({
            id: cardId,
            kind: "card"
          } satisfies TooltipTarget)
        : null;
    };
    const resolveExpandedImage = (element: HTMLElement) => {
      const imageSrc = element.dataset.imageSrc;
      const imageAlt = element.dataset.imageAlt;
      const imageCaption = element.dataset.imageCaption;

      if (typeof imageSrc !== "string" || typeof imageAlt !== "string") {
        return null;
      }

      return {
        alt: imageAlt,
        captionText:
          typeof imageCaption === "string" && imageCaption.trim().length > 0
            ? imageCaption
            : null,
        presentation: resolveImagePresentation(imageSrc),
        src: imageSrc
      } satisfies ExpandedImageState;
    };

    const resolveReferenceTarget = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(referenceSelector)
        : null;
    const resolveImageElement = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(imageSelector)
        : null;
    const resolveZoomableImageTarget = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(zoomableImageSelector)
        : null;
    const resolveRubyTarget = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("ruby") : null;

    references.forEach((element) => {
      const target = resolveEntryTarget(element);

      element.classList.add("reader-ref");
      element.classList.toggle("reader-ref--term", target?.kind === "term");
      element.classList.toggle(
        "reader-ref--grammar",
        target?.kind === "grammar"
      );
      element.classList.toggle(
        "reader-ref--active",
        target ? activeEntryKey === getTooltipEntryKey(target) : false
      );

      if (target) {
        element.setAttribute("role", "button");
        element.tabIndex = 0;
        return;
      }

      element.removeAttribute("role");
      element.removeAttribute("tabindex");
    });

    images.forEach((element) => {
      const target = resolveImageEntryTarget(element);

      element.classList.toggle("reader-image--interactive", Boolean(target));
      element.classList.toggle(
        "reader-image--active",
        target ? activeEntryKey === getTooltipEntryKey(target) : false
      );

      if (target) {
        element.setAttribute("role", "button");
        element.tabIndex = 0;
        return;
      }

      element.removeAttribute("role");
      element.removeAttribute("tabindex");
    });

    zoomableImages.forEach((element) => {
      element.classList.add("reader-image--zoomable");
      element.setAttribute("role", "button");
      element.tabIndex = 0;
    });

    rubies.forEach((element) => {
      element.classList.add("reader-ruby");
      element.tabIndex = furiganaMode === "hover" ? 0 : -1;

      if (furiganaMode !== "hover") {
        delete element.dataset.revealed;
      }
    });

    const toggleRuby = (element: HTMLElement) => {
      if (furiganaMode !== "hover" || !isTouchLayout) {
        return;
      }

      element.dataset.revealed =
        element.dataset.revealed === "true" ? "false" : "true";
    };

    const handleMouseOver = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const related = event.relatedTarget;

        if (related instanceof Node && element.contains(related)) {
          return;
        }

        const entryTarget = resolveEntryTarget(element);

        if (entryTarget) {
          onReferenceHover(entryTarget, element, "hover");
          return;
        }
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const related = event.relatedTarget;

        if (related instanceof Node && image.contains(related)) {
          return;
        }

        const imageTarget = resolveImageEntryTarget(image);

        if (imageTarget) {
          onReferenceHover(imageTarget, image, "hover");
        }
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const related = event.relatedTarget;

        if (related instanceof Node && element.contains(related)) {
          return;
        }

        onReferenceLeave();
        return;
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const related = event.relatedTarget;

        if (related instanceof Node && image.contains(related)) {
          return;
        }

        onReferenceLeave();
        return;
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const entryTarget = resolveEntryTarget(element);

        if (entryTarget) {
          onReferenceFocus(entryTarget, element, "focus");
          return;
        }
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const imageTarget = resolveImageEntryTarget(image);

        if (imageTarget) {
          onReferenceFocus(imageTarget, image, "focus");
        }
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const related = event.relatedTarget;

        if (related instanceof Node && element.contains(related)) {
          return;
        }

        onReferenceBlur();
        return;
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const related = event.relatedTarget;

        if (related instanceof Node && image.contains(related)) {
          return;
        }

        onReferenceBlur();
      }

      const ruby = resolveRubyTarget(event.target);

      if (ruby) {
        delete ruby.dataset.revealed;
      }
    };

    const handleClick = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const entryTarget = resolveEntryTarget(element);

        if (entryTarget) {
          event.preventDefault();
          onReferenceClick(entryTarget, element, "click");
        }

        return;
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const imageTarget = resolveImageEntryTarget(image);

        if (imageTarget) {
          event.preventDefault();
          onReferenceClick(imageTarget, image, "click");
        }

        return;
      }

      const zoomableImage = resolveZoomableImageTarget(event.target);

      if (zoomableImage) {
        const expandedImage = resolveExpandedImage(zoomableImage);

        if (expandedImage) {
          event.preventDefault();
          onImageExpand(expandedImage);
        }

        return;
      }

      const ruby = resolveRubyTarget(event.target);

      if (ruby) {
        toggleRuby(ruby);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const element = resolveReferenceTarget(event.target);

      if (element) {
        const entryTarget = resolveEntryTarget(element);

        if (entryTarget) {
          event.preventDefault();
          onReferenceClick(entryTarget, element, "click");
        }

        return;
      }

      const image = resolveImageElement(event.target);

      if (image) {
        const imageTarget = resolveImageEntryTarget(image);

        if (imageTarget) {
          event.preventDefault();
          onReferenceClick(imageTarget, image, "click");
        }

        return;
      }

      const zoomableImage = resolveZoomableImageTarget(event.target);

      if (zoomableImage) {
        const expandedImage = resolveExpandedImage(zoomableImage);

        if (expandedImage) {
          event.preventDefault();
          onImageExpand(expandedImage);
        }

        return;
      }

      const ruby = resolveRubyTarget(event.target);

      if (ruby) {
        event.preventDefault();
        toggleRuby(ruby);
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);
    container.addEventListener("click", handleClick);
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("focusout", handleFocusOut);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeEntryKey,
    furiganaMode,
    isTouchLayout,
    onReferenceBlur,
    onReferenceClick,
    onReferenceFocus,
    onReferenceHover,
    onReferenceLeave,
    onImageExpand
  ]);

  return (
    <div
      className="reader-article reader-article--fallback"
      dangerouslySetInnerHTML={{ __html: html }}
      ref={containerRef}
    />
  );
}

type ReferenceTokenProps = {
  active: boolean;
  children: ReactNode;
  kind: "term" | "grammar";
  onBlur: () => void;
  onClick: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onFocus: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onHover: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onLeave: () => void;
  target: TooltipTarget;
};

function ReferenceToken({
  active,
  children,
  kind,
  onBlur,
  onClick,
  onFocus,
  onHover,
  onLeave,
  target
}: ReferenceTokenProps) {
  const ref = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      className={cx(
        "reader-ref",
        kind === "grammar" ? "reader-ref--grammar" : "reader-ref--term",
        active && "reader-ref--active"
      )}
      onBlur={onBlur}
      onClick={() => {
        if (ref.current) {
          onClick(target, ref.current, "click");
        }
      }}
      onFocus={() => {
        if (ref.current) {
          onFocus(target, ref.current, "focus");
        }
      }}
      onMouseEnter={() => {
        if (ref.current) {
          onHover(target, ref.current, "hover");
        }
      }}
      onMouseLeave={onLeave}
      ref={ref}
      type="button"
    >
      {children}
    </button>
  );
}

type FuriganaRubyProps = {
  base: string;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  reading: string;
};

function FuriganaRuby({
  base,
  furiganaMode,
  isTouchLayout,
  reading
}: FuriganaRubyProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <ruby
      className="reader-ruby"
      data-revealed={furiganaMode === "hover" && revealed}
      onClick={() => {
        if (furiganaMode === "hover" && isTouchLayout) {
          setRevealed((current) => !current);
        }
      }}
      onBlur={() => setRevealed(false)}
      tabIndex={furiganaMode === "hover" ? 0 : -1}
    >
      {base}
      <rt>{reading}</rt>
    </ruby>
  );
}

type EntryTooltipCardProps = {
  entry: TextbookTooltipEntry | null;
  isLoading?: boolean;
  mobile?: boolean;
  onRetry?: () => void;
};

function EntryTooltipCard({
  entry,
  isLoading = false,
  mobile = false,
  onRetry
}: EntryTooltipCardProps) {
  if (!entry) {
    return (
      <div
        className={cx(
          "entry-tooltip-card",
          mobile && "entry-tooltip-card--mobile"
        )}
      >
        <div className="entry-tooltip-card__top">
          <span className="chip chip--grammar">
            {isLoading ? "Caricamento" : "Dettagli"}
          </span>
        </div>
        <p className="entry-tooltip-card__meaning">
          {isLoading
            ? "Sto caricando i dettagli del riferimento."
            : "I dettagli del riferimento non sono disponibili al momento."}
        </p>
        {onRetry ? (
          <button className="text-link" onClick={onRetry} type="button">
            Riprova
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "entry-tooltip-card",
        mobile && "entry-tooltip-card--mobile"
      )}
    >
      <div className="entry-tooltip-card__top">
        <span
          className={cx(
            "chip",
            (entry.kind === "grammar" || entry.kind === "card") &&
              "chip--grammar"
          )}
        >
          {entry.kind === "term"
            ? "Termine"
            : entry.kind === "grammar"
              ? "Grammatica"
              : "Card"}
        </span>
        <span className="meta-pill">{entry.statusLabel}</span>
      </div>
      <h2 className="entry-tooltip-card__title jp-inline">{entry.label}</h2>
      {"title" in entry && entry.title && entry.title !== entry.label ? (
        <p className="entry-tooltip-card__subtitle">{entry.title}</p>
      ) : null}
      {entry.reading || ("romaji" in entry && entry.romaji) ? (
        <p className="entry-tooltip-card__reading jp-inline">
          {[entry.reading, "romaji" in entry ? entry.romaji : undefined]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {entry.pronunciation ? (
        <PronunciationAudio audio={entry.pronunciation} compact />
      ) : null}
      <p className="entry-tooltip-card__meaning">{entry.meaning}</p>
      {"literalMeaning" in entry && entry.literalMeaning ? (
        <p className="entry-tooltip-card__detail">
          Letterale: {entry.literalMeaning}
        </p>
      ) : null}
      {"pos" in entry && entry.pos ? (
        <p className="entry-tooltip-card__detail">Categoria: {entry.pos}</p>
      ) : null}
      {"typeLabel" in entry ? (
        <p className="entry-tooltip-card__detail">
          Tipo card: {entry.typeLabel}
        </p>
      ) : null}
      {entry.notes ? (
        <p className="entry-tooltip-card__notes">
          {renderFurigana(entry.notes)}
        </p>
      ) : null}
      {"crossMediaHint" in entry && entry.crossMediaHint ? (
        <p className="entry-tooltip-card__detail">
          {formatCrossMediaHintLabel(entry.crossMediaHint.otherMediaCount)}
        </p>
      ) : null}
      <Link
        className="text-link"
        href={"glossaryHref" in entry ? entry.glossaryHref : entry.reviewHref}
      >
        {"glossaryHref" in entry ? "Apri voce" : "Apri card"}
      </Link>
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
