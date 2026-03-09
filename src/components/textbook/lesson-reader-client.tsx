"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  type CSSProperties,
  type ReactNode,
  startTransition,
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
  ContentBlock,
  InlineNode,
  MarkdownDocument
} from "@/lib/content/types";
import type {
  FuriganaMode,
  TextbookEntryTooltip,
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/lib/textbook";
import { mediaStudyHref, mediaTextbookLessonHref } from "@/lib/site";

type LessonReaderClientProps = {
  data: TextbookLessonData;
};

type TooltipState = {
  entry: TextbookEntryTooltip;
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
      entry: TextbookEntryTooltip;
    };

export function LessonReaderClient({ data }: LessonReaderClientProps) {
  const router = useRouter();
  const [furiganaMode, setFuriganaModeState] = useState<FuriganaMode>(
    data.furiganaMode
  );
  const [lessonStatus, setLessonStatus] = useState(data.lesson.status);
  const [isTouchLayout, setIsTouchLayout] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetState | null>(null);
  const [isSavingFurigana, startSavingFurigana] = useTransition();
  const [isSavingLesson, startSavingLesson] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const entriesByKey = new Map(
    data.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry] as const)
  );

  useEffect(() => {
    const updateLayoutMode = () => {
      setIsTouchLayout(
        window.matchMedia("(hover: none), (pointer: coarse), (max-width: 960px)")
          .matches
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
    document.body.style.overflow = mobileSheet ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSheet]);

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
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => {
    clearCloseTimer();

    if (isTouchLayout) {
      setMobileSheet({
        type: "entry",
        entry
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
        current.entry.id === entry.id &&
        current.entry.kind === entry.kind &&
        current.locked &&
        intent === "click"
      ) {
        return null;
      }

      return {
        entry,
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
              <span>{lessonStatus === "completed" ? "Completata" : data.lesson.statusLabel}</span>
              {data.lesson.difficulty ? <span>{data.lesson.difficulty}</span> : null}
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
            {lessonStatus === "completed" ? "Segna in corso" : "Segna completata"}
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
          <span>{data.completedLessons}/{data.totalLessons} lette</span>
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
              activeEntryKey={tooltip ? `${tooltip.entry.kind}:${tooltip.entry.id}` : null}
              document={data.lesson.ast}
              entriesByKey={entriesByKey}
              fallbackHtml={data.lesson.htmlRendered}
              furiganaMode={furiganaMode}
              isTouchLayout={isTouchLayout}
              onReferenceBlur={closeTooltipSoon}
              onReferenceClick={openReference}
              onReferenceFocus={openReference}
              onReferenceHover={openReference}
              onReferenceLeave={closeTooltipSoon}
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
                lessonStatus === "completed" ? "button--ghost" : "button--primary"
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
          <EntryTooltipCard entry={tooltip.entry} />
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
            <EntryTooltipCard entry={mobileSheet.entry} mobile />
          )}
        </MobileSheet>
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
    { mode: "off", label: "Off" },
    { mode: "hover", label: "Hover" },
    { mode: "on", label: "On" }
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
            currentMode === option.mode && "reader-furigana-control__button--active"
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
    <div className={cx("reader-rail__card", compact && "reader-rail__card--compact")}>
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
  entriesByKey: Map<string, TextbookEntryTooltip>;
  fallbackHtml: string;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  onReferenceBlur: () => void;
  onReferenceClick: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceFocus: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceHover: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceLeave: () => void;
};

function LessonArticle({
  activeEntryKey,
  document,
  entriesByKey,
  fallbackHtml,
  furiganaMode,
  isTouchLayout,
  onReferenceBlur,
  onReferenceClick,
  onReferenceFocus,
  onReferenceHover,
  onReferenceLeave
}: LessonArticleProps) {
  if (!document) {
    return (
      <FallbackHtmlArticle
        activeEntryKey={activeEntryKey}
        entriesByKey={entriesByKey}
        fallbackHtml={fallbackHtml}
        furiganaMode={furiganaMode}
        isTouchLayout={isTouchLayout}
        onReferenceBlur={onReferenceBlur}
        onReferenceClick={onReferenceClick}
        onReferenceFocus={onReferenceFocus}
        onReferenceHover={onReferenceHover}
        onReferenceLeave={onReferenceLeave}
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
          const entry = entriesByKey.get(`${node.targetType}:${node.targetId}`);

          if (!entry) {
            return <Fragment key={index}>{renderInlineNodes(node.children)}</Fragment>;
          }

          return (
            <ReferenceToken
              active={activeEntryKey === `${entry.kind}:${entry.id}`}
              entry={entry}
              key={index}
              onBlur={onReferenceBlur}
              onClick={onReferenceClick}
              onFocus={onReferenceFocus}
              onHover={onReferenceHover}
              onLeave={onReferenceLeave}
            >
              {renderInlineNodes(node.children)}
            </ReferenceToken>
          );
        }
        case "emphasis":
          return <em key={index}>{renderInlineNodes(node.children)}</em>;
        case "strong":
          return <strong key={index}>{renderInlineNodes(node.children)}</strong>;
        case "inlineCode":
          return <code key={index}>{node.value}</code>;
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
      case "termDefinition":
        return (
          <section className="reader-definition-card" key={index}>
            <div className="reader-definition-card__eyebrow">
              <span className="chip">Term</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">{block.entry.lemma}</h3>
            <p className="reader-definition-card__reading jp-inline">
              {block.entry.reading} · {block.entry.romaji}
            </p>
            <p className="reader-definition-card__meaning">{block.entry.meaningIt}</p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">{block.entry.notesIt}</p>
            ) : null}
          </section>
        );
      case "grammarDefinition":
        return (
          <section className="reader-definition-card reader-definition-card--grammar" key={index}>
            <div className="reader-definition-card__eyebrow">
              <span className="chip chip--grammar">Grammar</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">{block.entry.pattern}</h3>
            <p className="reader-definition-card__meaning">{block.entry.meaningIt}</p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">{block.entry.notesIt}</p>
            ) : null}
          </section>
        );
      case "cardDefinition":
        return (
          <section className="reader-card-inline" key={index}>
            <div className="reader-card-inline__face">
              <span className="eyebrow">Card front</span>
              <div>{renderInlineNodes(block.card.front.nodes)}</div>
            </div>
            <div className="reader-card-inline__face reader-card-inline__face--back">
              <span className="eyebrow">Card back</span>
              <div>{renderInlineNodes(block.card.back.nodes)}</div>
            </div>
          </section>
        );
    }
  };

  return <article className="reader-article">{renderBlocks(document.blocks)}</article>;
}

type FallbackHtmlArticleProps = {
  activeEntryKey: string | null;
  entriesByKey: Map<string, TextbookEntryTooltip>;
  fallbackHtml: string;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  onReferenceBlur: () => void;
  onReferenceClick: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceFocus: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceHover: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceLeave: () => void;
};

function FallbackHtmlArticle({
  activeEntryKey,
  entriesByKey,
  fallbackHtml,
  furiganaMode,
  isTouchLayout,
  onReferenceBlur,
  onReferenceClick,
  onReferenceFocus,
  onReferenceHover,
  onReferenceLeave
}: FallbackHtmlArticleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const referenceSelector = ".content-entry-ref[data-entry-type][data-entry-id]";
    const references = Array.from(
      container.querySelectorAll<HTMLElement>(referenceSelector)
    );
    const rubies = Array.from(container.querySelectorAll<HTMLElement>("ruby"));

    const resolveEntry = (element: HTMLElement) => {
      const entryType = element.dataset.entryType;
      const entryId = element.dataset.entryId;

      if (
        (entryType !== "term" && entryType !== "grammar") ||
        typeof entryId !== "string"
      ) {
        return null;
      }

      return entriesByKey.get(`${entryType}:${entryId}`) ?? null;
    };

    const resolveReferenceTarget = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(referenceSelector)
        : null;
    const resolveRubyTarget = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("ruby") : null;

    references.forEach((element) => {
      const entry = resolveEntry(element);

      element.classList.add("reader-ref");
      element.classList.toggle("reader-ref--term", entry?.kind === "term");
      element.classList.toggle("reader-ref--grammar", entry?.kind === "grammar");
      element.classList.toggle(
        "reader-ref--active",
        activeEntryKey === `${entry?.kind}:${entry?.id}`
      );

      if (entry) {
        element.setAttribute("role", "button");
        element.tabIndex = 0;
        return;
      }

      element.removeAttribute("role");
      element.removeAttribute("tabindex");
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

      element.dataset.revealed = element.dataset.revealed === "true" ? "false" : "true";
    };

    const handleMouseOver = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (!element) {
        return;
      }

      const related = event.relatedTarget;

      if (related instanceof Node && element.contains(related)) {
        return;
      }

      const entry = resolveEntry(element);

      if (entry) {
        onReferenceHover(entry, element, "hover");
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (!element) {
        return;
      }

      const related = event.relatedTarget;

      if (related instanceof Node && element.contains(related)) {
        return;
      }

      onReferenceLeave();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const entry = resolveEntry(element);

        if (entry) {
          onReferenceFocus(entry, element, "focus");
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
      }

      const ruby = resolveRubyTarget(event.target);

      if (ruby) {
        delete ruby.dataset.revealed;
      }
    };

    const handleClick = (event: MouseEvent) => {
      const element = resolveReferenceTarget(event.target);

      if (element) {
        const entry = resolveEntry(element);

        if (entry) {
          event.preventDefault();
          onReferenceClick(entry, element, "click");
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
        const entry = resolveEntry(element);

        if (entry) {
          event.preventDefault();
          onReferenceClick(entry, element, "click");
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
    entriesByKey,
    furiganaMode,
    isTouchLayout,
    onReferenceBlur,
    onReferenceClick,
    onReferenceFocus,
    onReferenceHover,
    onReferenceLeave
  ]);

  return (
    <div
      className="reader-article reader-article--fallback"
      dangerouslySetInnerHTML={{ __html: fallbackHtml }}
      ref={containerRef}
    />
  );
}

type ReferenceTokenProps = {
  active: boolean;
  children: ReactNode;
  entry: TextbookEntryTooltip;
  onBlur: () => void;
  onClick: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onFocus: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onHover: (
    entry: TextbookEntryTooltip,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onLeave: () => void;
};

function ReferenceToken({
  active,
  children,
  entry,
  onBlur,
  onClick,
  onFocus,
  onHover,
  onLeave
}: ReferenceTokenProps) {
  const ref = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      className={cx(
        "reader-ref",
        entry.kind === "grammar" ? "reader-ref--grammar" : "reader-ref--term",
        active && "reader-ref--active"
      )}
      onBlur={onBlur}
      onClick={() => {
        if (ref.current) {
          onClick(entry, ref.current, "click");
        }
      }}
      onFocus={() => {
        if (ref.current) {
          onFocus(entry, ref.current, "focus");
        }
      }}
      onMouseEnter={() => {
        if (ref.current) {
          onHover(entry, ref.current, "hover");
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
  entry: TextbookEntryTooltip;
  mobile?: boolean;
};

function EntryTooltipCard({ entry, mobile = false }: EntryTooltipCardProps) {
  return (
    <div className={cx("entry-tooltip-card", mobile && "entry-tooltip-card--mobile")}>
      <div className="entry-tooltip-card__top">
        <span className={cx("chip", entry.kind === "grammar" && "chip--grammar")}>
          {entry.kind === "term" ? "Term" : "Grammar"}
        </span>
        <span className="meta-pill">{entry.statusLabel}</span>
      </div>
      <h2 className="entry-tooltip-card__title jp-inline">{entry.label}</h2>
      {entry.title && entry.title !== entry.label ? (
        <p className="entry-tooltip-card__subtitle">{entry.title}</p>
      ) : null}
      {entry.reading || entry.romaji ? (
        <p className="entry-tooltip-card__reading jp-inline">
          {[entry.reading, entry.romaji].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="entry-tooltip-card__meaning">{entry.meaning}</p>
      {entry.literalMeaning ? (
        <p className="entry-tooltip-card__detail">
          Letterale: {entry.literalMeaning}
        </p>
      ) : null}
      {entry.pos ? (
        <p className="entry-tooltip-card__detail">Categoria: {entry.pos}</p>
      ) : null}
      {entry.levelHint ? (
        <p className="entry-tooltip-card__detail">Livello: {entry.levelHint}</p>
      ) : null}
      {entry.segmentTitle ? (
        <p className="entry-tooltip-card__detail">Segmento: {entry.segmentTitle}</p>
      ) : null}
      {entry.notes ? <p className="entry-tooltip-card__notes">{entry.notes}</p> : null}
      <Link className="text-link" href={entry.glossaryHref}>
        Apri entry
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
