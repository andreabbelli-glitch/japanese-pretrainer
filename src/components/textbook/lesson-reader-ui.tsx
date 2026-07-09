import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { memo, type ReactNode, useEffect, useRef } from "react";

import { cx } from "@/features/shared/ui/classnames";
import type {
  FuriganaMode,
  TextbookLessonData,
  TextbookLessonNavItem
} from "@/features/textbook/types";
import { mediaStudyHref, mediaTextbookLessonHref } from "@/features/navigation";

import type { ExpandedImageState } from "./lesson-article";

type LessonReaderHeaderProps = {
  completedLessons: number;
  furiganaMode: FuriganaMode;
  isSavingFurigana: boolean;
  isSavingLesson: boolean;
  lesson: TextbookLessonData["lesson"];
  lessonStatus: TextbookLessonData["lesson"]["status"];
  media: TextbookLessonData["media"];
  onFuriganaModeChange: (mode: FuriganaMode) => void;
  onToggleLessonCompletion: () => void;
  totalLessons: number;
};

export function LessonReaderHeader({
  completedLessons,
  furiganaMode,
  isSavingFurigana,
  isSavingLesson,
  lesson,
  lessonStatus,
  media,
  onFuriganaModeChange,
  onToggleLessonCompletion,
  totalLessons
}: LessonReaderHeaderProps) {
  return (
    <header className="reader-study-header">
      <div className="reader-study-header__left">
        <Link
          className="reader-study-header__back"
          href={mediaStudyHref(media.slug, "textbook")}
        >
          {media.title} / Textbook
        </Link>
        <div className="reader-study-header__copy">
          <p className="eyebrow">{lesson.segmentTitle}</p>
          <h1 className="reader-study-header__title">{lesson.title}</h1>
          <div className="reader-study-header__meta">
            <span>
              {completedLessons}/{totalLessons} lette
            </span>
            <span>
              {lessonStatus === "completed" ? "Completata" : lesson.statusLabel}
            </span>
            {lesson.difficulty ? <span>{lesson.difficulty}</span> : null}
          </div>
        </div>
      </div>

      <div className="reader-study-header__actions">
        <FuriganaModeControl
          currentMode={furiganaMode}
          disabled={isSavingFurigana}
          onChange={onFuriganaModeChange}
        />
        <div className="reader-completion-control">
          <button
            className={cx(
              "button",
              lessonStatus === "completed" ? "button--ghost" : "button--primary"
            )}
            disabled={isSavingLesson}
            onClick={onToggleLessonCompletion}
            type="button"
          >
            {lessonStatus === "completed"
              ? "Segna in corso"
              : "Completa lesson"}
          </button>
          {lessonStatus !== "completed" ? <CompletionHelper /> : null}
        </div>
      </div>
    </header>
  );
}

type LessonReaderMobileStripProps = {
  completedLessons: number;
  furiganaMode: FuriganaMode;
  onOpenLessons: (opener: HTMLButtonElement) => void;
  totalLessons: number;
};

export function LessonReaderMobileStrip({
  completedLessons,
  furiganaMode,
  onOpenLessons,
  totalLessons
}: LessonReaderMobileStripProps) {
  return (
    <div className="reader-mobile-strip">
      <button
        className="button button--ghost reader-mobile-strip__button"
        onClick={(event) => onOpenLessons(event.currentTarget)}
        type="button"
      >
        Lezioni
      </button>
      <div className="reader-mobile-strip__status">
        <span>
          {completedLessons}/{totalLessons} lette
        </span>
        <span>Furigana: {furiganaMode}</span>
      </div>
    </div>
  );
}

type LessonReaderFooterProps = {
  isSavingLesson: boolean;
  lessonStatus: TextbookLessonData["lesson"]["status"];
  mediaSlug: string;
  nextLesson: TextbookLessonNavItem | null;
  onToggleLessonCompletion: () => void;
  previousLesson: TextbookLessonNavItem | null;
  reviewHref: Route;
};

export function LessonReaderFooter({
  isSavingLesson,
  lessonStatus,
  mediaSlug,
  nextLesson,
  onToggleLessonCompletion,
  previousLesson,
  reviewHref
}: LessonReaderFooterProps) {
  return (
    <footer className="reader-footer">
      <div className="reader-footer__nav">
        {previousLesson ? (
          <LessonNavLink
            direction="prev"
            lesson={previousLesson}
            mediaSlug={mediaSlug}
          />
        ) : (
          <div className="reader-footer__placeholder" />
        )}
        {nextLesson ? (
          <LessonNavLink
            direction="next"
            lesson={nextLesson}
            mediaSlug={mediaSlug}
          />
        ) : (
          <div className="reader-footer__placeholder" />
        )}
      </div>

      {lessonStatus === "completed" ? (
        <Link className="button button--primary" href={reviewHref}>
          Vai alla review del capitolo
        </Link>
      ) : null}

      <div className="reader-completion-control reader-completion-control--footer">
        <button
          className={cx(
            "button",
            lessonStatus === "completed" ? "button--ghost" : "button--primary"
          )}
          disabled={isSavingLesson}
          onClick={onToggleLessonCompletion}
          type="button"
        >
          {lessonStatus === "completed" ? "Riapri lesson" : "Completa lesson"}
        </button>
        {lessonStatus !== "completed" ? <CompletionHelper /> : null}
      </div>
    </footer>
  );
}

function CompletionHelper() {
  return (
    <p className="reader-completion-control__hint">
      Se ci sono nuove card, passerai al Consolidamento.
    </p>
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
  const options: Array<{ label: string; mode: FuriganaMode }> = [
    { mode: "off", label: "Nascoste" },
    { mode: "hover", label: "Al passaggio" },
    { mode: "on", label: "Sempre" }
  ];

  return (
    <div
      aria-busy={disabled}
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
          disabled={disabled && currentMode === option.mode}
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

export function LessonRail({
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

export function areLessonRailPropsEqual(
  previous: Readonly<LessonRailProps>,
  next: Readonly<LessonRailProps>
) {
  return (
    previous.activeLessonId === next.activeLessonId &&
    previous.compact === next.compact &&
    previous.groups === next.groups &&
    previous.mediaSlug === next.mediaSlug &&
    previous.onNavigate === next.onNavigate
  );
}

export const MemoizedLessonRail = memo(LessonRail, areLessonRailPropsEqual);

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
  ariaLabel: string;
  children?: ReactNode;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
};

const SHEET_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function MobileSheet({
  ariaLabel,
  children,
  onClose,
  returnFocusTo
}: MobileSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const returnFocusElement = returnFocusTo;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !surfaceRef.current) {
        return;
      }

      const surface = surfaceRef.current;
      const focusableElements = Array.from(
        surface.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) {
        event.preventDefault();
        surface.focus();
        return;
      }

      if (
        event.shiftKey &&
        (activeElement === firstElement || !surface.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !surface.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus();
      }
    };
  }, [onClose, returnFocusTo]);

  return (
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className="reader-sheet"
      role="dialog"
    >
      <button
        aria-label="Chiudi pannello"
        className="reader-sheet__backdrop"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div className="reader-sheet__surface" ref={surfaceRef} tabIndex={-1}>
        <div className="reader-sheet__handle" />
        <button
          autoFocus
          className="reader-sheet__close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
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
  returnFocusTo: HTMLButtonElement | null;
};

export function ReaderImageLightbox({
  image,
  onClose,
  returnFocusTo
}: ReaderImageLightboxProps) {
  const caption = image.captionText ?? image.alt;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const returnFocusElement = returnFocusTo;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !surfaceRef.current) {
        return;
      }

      const surface = surfaceRef.current;
      const focusableElements = Array.from(
        surface.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) {
        event.preventDefault();
        surface.focus();
        return;
      }

      if (
        event.shiftKey &&
        (activeElement === firstElement || !surface.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !surface.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus();
      }
    };
  }, [onClose, returnFocusTo]);

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
        tabIndex={-1}
        type="button"
      />
      <div
        className="reader-image-lightbox__surface"
        ref={surfaceRef}
        tabIndex={-1}
      >
        <div className="reader-image-lightbox__top">
          <p className="eyebrow">Immagine</p>
          <button
            autoFocus
            className="button button--ghost button--small"
            onClick={onClose}
            ref={closeButtonRef}
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
