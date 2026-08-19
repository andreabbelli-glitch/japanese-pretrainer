"use client";

import { useCallback, useEffect, useState } from "react";

import { buildReviewSessionHref } from "@/features/navigation";
import { cx } from "@/features/shared/ui/classnames";
import type { TextbookLessonData } from "@/features/textbook/types";

import {
  EntryTooltipCard,
  type ExpandedImageState,
  LessonArticle
} from "./lesson-article";
import {
  MemoizedLessonRail,
  LessonReaderFooter,
  LessonReaderHeader,
  LessonReaderMobileStrip,
  MobileSheet,
  ReaderImageLightbox
} from "./lesson-reader-ui";
import { useFuriganaPreference } from "./use-furigana-preference";
import { useLessonReaderProgress } from "./use-lesson-reader-progress";
import { useLessonReferences } from "./use-lesson-references";

export {
  LessonArticle,
  formatCrossMediaHintLabel,
  hasLessonTooltipTargets
} from "./lesson-article";
export { areLessonRailPropsEqual } from "./lesson-reader-ui";

type LessonReaderClientProps = {
  data: TextbookLessonData;
};

export function LessonReaderClient({ data }: LessonReaderClientProps) {
  const { isSavingLesson, readerData, toggleLessonCompletion } =
    useLessonReaderProgress(data);
  const { furiganaMode, handleFuriganaModeChange, isSavingFurigana } =
    useFuriganaPreference(data);
  const {
    audioPreloadEntryKey,
    clearCloseTimer,
    closeMobileSheet,
    closeTooltipSoon,
    dismissTooltip,
    ensureTooltipEntries,
    isTouchLayout,
    mobileSheet,
    mobileSheetEntry,
    mobileSheetOpener,
    openLessonSheet,
    openReference,
    tooltip,
    tooltipEntry,
    tooltipLoadState,
    tooltipRef,
    tooltipStyle
  } = useLessonReferences({ readerData, sourceData: data });
  const [expandedImage, setExpandedImage] = useState<ExpandedImageState | null>(
    null
  );
  const [imageLightboxOpener, setImageLightboxOpener] =
    useState<HTMLButtonElement | null>(null);
  const lessonStatus = readerData.lesson.status;

  useEffect(() => {
    document.body.style.overflow = mobileSheet || expandedImage ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [expandedImage, mobileSheet]);

  const handleCloseExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);

  const openImage = useCallback(
    (image: ExpandedImageState, opener: HTMLButtonElement) => {
      clearCloseTimer();
      dismissTooltip();
      setImageLightboxOpener(opener);
      setExpandedImage(image);
    },
    [clearCloseTimer, dismissTooltip]
  );

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
        onOpenLessons={openLessonSheet}
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
          onClose={closeMobileSheet}
          returnFocusTo={mobileSheetOpener}
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
                onNavigate={closeMobileSheet}
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
          returnFocusTo={imageLightboxOpener}
        />
      ) : null}
    </div>
  );
}
