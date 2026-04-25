"use client";

import Link from "next/link";
import { useMemo, type TouchEventHandler } from "react";

import type {
  KanjiClashEligibleSubject,
  KanjiClashManualContrastSummary,
  KanjiClashPageData,
  KanjiClashQueueSnapshot,
  KanjiClashSessionRound
} from "@/features/kanji-clash/types";
import { cx } from "@/lib/classnames";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatKanjiClashPairStateLabel,
  formatKanjiClashSimilarKanjiSwaps,
  formatKanjiClashRoundPosition,
  formatKanjiClashRoundSource,
  getKanjiClashSubjectMeaning,
  getKanjiClashSubjectReading
} from "./kanji-clash-format";
import {
  buildKanjiClashPageContent,
  type KanjiClashPageContent
} from "./kanji-clash-page-content";
import {
  useKanjiClashRoundController,
  type KanjiClashRoundFeedback
} from "./use-kanji-clash-round-controller";

type KanjiClashPageProps = {
  data: KanjiClashPageData;
};

export function KanjiClashPage({ data }: KanjiClashPageProps) {
  const controllerKey = [
    data.mode,
    data.scope,
    data.selectedMedia?.slug ?? "global",
    data.queue.requestedSize ?? "auto"
  ].join(":");

  return <KanjiClashPageClient key={controllerKey} data={data} />;
}

function KanjiClashPageClient({ data }: KanjiClashPageProps) {
  const controller = useKanjiClashRoundController(data);
  const content: KanjiClashPageContent = useMemo(
    () =>
      buildKanjiClashPageContent({
        currentRound: controller.currentRound,
        data,
        feedback: controller.feedback,
        queue: controller.queue
      }),
    [controller.currentRound, controller.feedback, controller.queue, data]
  );

  return (
    <div className="kanji-clash-page">
      <StickyPageHeader
        eyebrow="Kanji Clash"
        title="Workspace di confronto"
        summary={content.header.summary}
        actions={
          <div className="hero-actions">
            <Link
              aria-current={data.mode === "automatic" ? "page" : undefined}
              className={buttonClassName(data.mode === "automatic")}
              href={content.header.modeLinks.automatic}
            >
              FSRS
            </Link>
            <Link
              aria-current={data.mode === "manual" ? "page" : undefined}
              className={buttonClassName(data.mode === "manual")}
              href={content.header.modeLinks.manual}
            >
              Drill
            </Link>
          </div>
        }
      />

      <section className="hero-grid hero-grid--detail kanji-clash-workspace">
        {controller.currentRound ? (
          <KanjiClashRoundWorkspace
            archivePendingContrastKey={controller.archivePendingContrastKey}
            clientError={controller.clientError}
            feedback={controller.feedback}
            feedbackCopy={
              controller.feedback?.status === "incorrect"
                ? content.round.feedbackCopy
                : null
            }
            isSelectionLocked={controller.isSelectionLocked}
            liveMessage={controller.liveMessage}
            manualContrastStatusByKey={controller.manualContrastStatusByKey}
            onArchiveManualContrast={controller.handleArchiveManualContrast}
            onChooseSide={controller.handleChooseSide}
            onContinue={controller.handleContinue}
            onRestoreManualContrast={controller.handleRestoreManualContrast}
            onTouchEnd={controller.handleTouchEnd}
            onTouchStart={controller.handleTouchStart}
            pendingSelectionSide={controller.pendingSelectionSide}
            queue={controller.queue}
            round={controller.currentRound}
            roundSummary={content.round.summary}
            scopeLabel={content.round.scopeLabel}
          />
        ) : (
          <KanjiClashEmptyWorkspace content={content.emptyState} />
        )}

        <KanjiClashSidebar
          activeManualContrasts={controller.activeManualContrasts}
          archivePendingContrastKey={controller.archivePendingContrastKey}
          archivedManualContrasts={controller.archivedManualContrasts}
          content={content.sidebar}
          onArchiveManualContrast={controller.handleArchiveManualContrast}
          onRestoreManualContrast={controller.handleRestoreManualContrast}
          queue={controller.queue}
        />
      </section>
    </div>
  );
}

function KanjiClashRoundWorkspace({
  archivePendingContrastKey,
  clientError,
  feedback,
  feedbackCopy,
  isSelectionLocked,
  liveMessage,
  manualContrastStatusByKey,
  onArchiveManualContrast,
  onChooseSide,
  onContinue,
  onRestoreManualContrast,
  onTouchEnd,
  onTouchStart,
  pendingSelectionSide,
  queue,
  round,
  roundSummary,
  scopeLabel
}: {
  archivePendingContrastKey: string | null;
  clientError: string | null;
  feedback: KanjiClashRoundFeedback | null;
  feedbackCopy: {
    description: string;
    title: string;
  } | null;
  isSelectionLocked: boolean;
  liveMessage: string | null;
  manualContrastStatusByKey: Record<
    string,
    KanjiClashManualContrastSummary["status"]
  >;
  onArchiveManualContrast: (contrastKey: string) => void;
  onChooseSide: (side: "left" | "right") => void;
  onContinue: () => void;
  onRestoreManualContrast: (contrastKey: string) => void;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchStart: TouchEventHandler<HTMLElement>;
  pendingSelectionSide: "left" | "right" | null;
  queue: KanjiClashQueueSnapshot;
  round: KanjiClashSessionRound;
  roundSummary: string;
  scopeLabel: string;
}) {
  const manualContrastKey =
    round.origin.type === "manual-contrast" ? round.origin.contrastKey : null;
  const manualContrastStatus = manualContrastKey
    ? (manualContrastStatusByKey[manualContrastKey] ?? "active")
    : null;

  return (
    <article
      className="surface-card surface-card--hero kanji-clash-stage"
      data-pair-key={round.pairKey}
      data-target-subject-key={round.targetSubjectKey}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
    >
      <div className="kanji-clash-stage__top">
        <div className="kanji-clash-stage__copy">
          <p className="eyebrow">Round attuale</p>
          <h2 className="kanji-clash-stage__title">
            {formatKanjiClashRoundPosition(
              queue.currentRoundIndex,
              queue.totalCount
            )}
          </h2>
          <p className="kanji-clash-stage__summary">{roundSummary}</p>
        </div>
        <div className="kanji-clash-stage__chips">
          <span className="chip">
            {formatKanjiClashRoundSource(round.source)}
          </span>
          <span className="meta-pill">{scopeLabel}</span>
          {round.pairState ? (
            <span className="meta-pill">
              {formatKanjiClashPairStateLabel(round.pairState.state)}
            </span>
          ) : null}
          {feedback?.status === "incorrect" ? (
            <span
              className={cx(
                "meta-pill",
                "kanji-clash-feedback-pill--incorrect"
              )}
            >
              Conferma richiesta
            </span>
          ) : null}
          {manualContrastKey ? (
            <button
              className="button button--ghost button--small"
              disabled={archivePendingContrastKey === manualContrastKey}
              onClick={() => {
                if (manualContrastStatus === "archived") {
                  onRestoreManualContrast(manualContrastKey);
                  return;
                }

                onArchiveManualContrast(manualContrastKey);
              }}
              type="button"
            >
              {archivePendingContrastKey === manualContrastKey
                ? manualContrastStatus === "archived"
                  ? "Ripristino..."
                  : "Archiviazione..."
                : manualContrastStatus === "archived"
                  ? "Ripristina contrasto"
                  : "Archivia contrasto"}
            </button>
          ) : null}
        </div>
      </div>

      {liveMessage ? (
        <p aria-live="polite" className="sr-only" role="status">
          {liveMessage}
        </p>
      ) : null}

      <div className="kanji-clash-round-grid">
        <KanjiClashOptionCard
          disabled={isSelectionLocked}
          feedback={feedback}
          onSelect={() => onChooseSide("left")}
          pendingSelectionSide={pendingSelectionSide}
          side="left"
          subject={round.left}
        />

        <SurfaceCard className="kanji-clash-target" variant="accent">
          <p className="eyebrow">Target</p>
          <h3 className="kanji-clash-target__reading jp-inline">
            {getKanjiClashSubjectReading(round.target)}
          </h3>
          <p className="kanji-clash-target__meaning">
            {getKanjiClashSubjectMeaning(round.target)}
          </p>
          {round.candidate.sharedKanji.length > 0 ||
          round.candidate.similarKanjiSwaps.length > 0 ? (
            <div className="kanji-clash-target__chips">
              {round.candidate.sharedKanji.map((kanji) => (
                <span key={kanji} className="chip">
                  {kanji}
                </span>
              ))}
              {round.candidate.similarKanjiSwaps.length > 0 ? (
                <span className="meta-pill">
                  {formatKanjiClashSimilarKanjiSwaps(
                    round.candidate.similarKanjiSwaps
                  )}
                </span>
              ) : null}
            </div>
          ) : null}
        </SurfaceCard>

        <KanjiClashOptionCard
          disabled={isSelectionLocked}
          feedback={feedback}
          onSelect={() => onChooseSide("right")}
          pendingSelectionSide={pendingSelectionSide}
          side="right"
          subject={round.right}
        />
      </div>

      {feedbackCopy ? (
        <div
          aria-live="assertive"
          className={cx(
            "kanji-clash-feedback",
            "kanji-clash-feedback--incorrect"
          )}
          role="alert"
        >
          <p className="kanji-clash-feedback__title">{feedbackCopy.title}</p>
          <p className="kanji-clash-feedback__summary">
            {feedbackCopy.description}
          </p>
          <button
            className="button button--primary button--small"
            onClick={onContinue}
            type="button"
          >
            {feedback?.nextRound ? "Continua" : "Chiudi sessione"}
          </button>
        </div>
      ) : null}

      {clientError ? (
        <p className="kanji-clash-stage__error" role="alert">
          {clientError}
        </p>
      ) : null}
    </article>
  );
}

function KanjiClashOptionCard({
  disabled,
  feedback,
  onSelect,
  pendingSelectionSide,
  side,
  subject
}: {
  disabled: boolean;
  feedback: KanjiClashRoundFeedback | null;
  onSelect: () => void;
  pendingSelectionSide: "left" | "right" | null;
  side: "left" | "right";
  subject: KanjiClashEligibleSubject;
}) {
  const isSelected =
    feedback?.selectedSide === side || pendingSelectionSide === side;
  const isCorrectReveal =
    feedback?.status === "incorrect" &&
    feedback.correctSubjectKey === subject.subjectKey;
  const isWrong =
    feedback?.status === "incorrect" &&
    feedback.selectedSubjectKey === subject.subjectKey;
  const isCorrect =
    feedback?.status === "correct" &&
    feedback.selectedSubjectKey === subject.subjectKey;
  const badgeLabel = feedback
    ? isCorrectReveal
      ? "Corretto"
      : isCorrect
        ? "Scelta giusta"
        : isWrong
          ? "Scelta"
          : null
    : null;

  return (
    <button
      aria-pressed={isSelected}
      className={cx(
        "surface-card",
        "surface-card--quiet",
        "kanji-clash-option",
        `kanji-clash-option--${side}`,
        isSelected && "kanji-clash-option--selected",
        isCorrect && "kanji-clash-option--correct",
        isWrong && "kanji-clash-option--wrong",
        isCorrectReveal && "kanji-clash-option--revealed"
      )}
      data-side={side}
      data-subject-key={subject.subjectKey}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <h3 className="kanji-clash-option__surface jp-inline">
        {subject.surfaceForms[0] ?? subject.label}
      </h3>
      {badgeLabel ? (
        <span className="kanji-clash-option__badge meta-pill">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}

function KanjiClashEmptyWorkspace({
  content
}: {
  content: KanjiClashPageContent["emptyState"];
}) {
  if (!content) {
    return null;
  }

  return (
    <EmptyState
      eyebrow="Kanji Clash"
      title={content.title}
      description={content.description}
      action={
        <div className="empty-state__action">
          {content.topUpAction ? (
            <Link
              className="button button--primary"
              href={content.topUpAction.href}
            >
              {content.topUpAction.label}
            </Link>
          ) : null}
          <Link
            className={
              content.topUpAction
                ? "button button--ghost"
                : "button button--primary"
            }
            href={content.primaryAction.href}
          >
            {content.primaryAction.label}
          </Link>
          {content.secondaryAction ? (
            <Link
              className="button button--ghost"
              href={content.secondaryAction.href}
            >
              {content.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      }
    />
  );
}

function KanjiClashSidebar({
  activeManualContrasts,
  archivePendingContrastKey,
  archivedManualContrasts,
  queue,
  content,
  onArchiveManualContrast,
  onRestoreManualContrast
}: {
  activeManualContrasts: KanjiClashManualContrastSummary[];
  archivePendingContrastKey: string | null;
  archivedManualContrasts: KanjiClashManualContrastSummary[];
  queue: KanjiClashQueueSnapshot;
  content: KanjiClashPageContent["sidebar"];
  onArchiveManualContrast: (contrastKey: string) => void;
  onRestoreManualContrast: (contrastKey: string) => void;
}) {
  return (
    <SurfaceCard className="kanji-clash-sidebar" variant="quiet">
      <div className="kanji-clash-sidebar__copy">
        <p className="eyebrow">Contesto</p>
        <h2 className="kanji-clash-sidebar__title">{content.modeLabel}</h2>
        <p className="kanji-clash-sidebar__summary">{content.summary}</p>
      </div>

      <div className="stats-grid stats-grid--compact">
        <StatBlock
          detail={content.stats.scopeDetail}
          label="Ambito"
          value={content.stats.scopeValue}
        />
        <StatBlock
          detail={content.stats.queueDetail}
          label="In coda"
          value={String(queue.totalCount)}
        />
        <StatBlock
          detail={content.stats.remainingDetail}
          label="Rimanenti"
          tone={content.stats.remainingTone}
          value={String(queue.remainingCount)}
        />
        <StatBlock
          detail={content.stats.newDetail}
          label="Nuove"
          value={String(queue.newQueuedCount)}
        />
      </div>

      <div className="kanji-clash-sidebar__controls">
        <div>
          <p className="eyebrow">Filtro media</p>
          <div className="hero-actions">
            {content.mediaFilters.map((media) => (
              <Link
                key={media.href}
                aria-current={media.active ? "page" : undefined}
                className={buttonClassName(media.active)}
                href={media.href}
              >
                {media.label}
              </Link>
            ))}
          </div>
        </div>

        {content.sizeFilters ? (
          <div>
            <p className="eyebrow">Dimensione sessione</p>
            <div className="hero-actions">
              {content.sizeFilters.map((size) => (
                <Link
                  key={size.href}
                  aria-current={size.active ? "page" : undefined}
                  className={buttonClassName(size.active)}
                  href={size.href}
                >
                  {size.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="kanji-clash-sidebar__note">{content.note}</p>
        )}

        {activeManualContrasts.length > 0 ? (
          <div>
            <p className="eyebrow">Contrasti manuali attivi</p>
            <div className="kanji-clash-sidebar__manual-contrasts">
              {activeManualContrasts.map((contrast) => (
                <div
                  key={contrast.contrastKey}
                  className="surface-card surface-card--quiet"
                >
                  <p className="kanji-clash-sidebar__manual-label">
                    {contrast.leftLabel} / {contrast.rightLabel}
                  </p>
                  <button
                    className="button button--ghost button--small"
                    disabled={
                      archivePendingContrastKey === contrast.contrastKey
                    }
                    onClick={() =>
                      onArchiveManualContrast(contrast.contrastKey)
                    }
                    type="button"
                  >
                    {archivePendingContrastKey === contrast.contrastKey
                      ? "Archiviazione..."
                      : "Archivia"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {archivedManualContrasts.length > 0 ? (
          <div>
            <p className="eyebrow">Contrasti archiviati</p>
            <div className="kanji-clash-sidebar__manual-contrasts">
              {archivedManualContrasts.map((contrast) => (
                <div
                  key={contrast.contrastKey}
                  className="surface-card surface-card--quiet"
                >
                  <p className="kanji-clash-sidebar__manual-label">
                    {contrast.leftLabel} / {contrast.rightLabel}
                  </p>
                  <button
                    className="button button--ghost button--small"
                    disabled={
                      archivePendingContrastKey === contrast.contrastKey
                    }
                    onClick={() =>
                      onRestoreManualContrast(contrast.contrastKey)
                    }
                    type="button"
                  >
                    {archivePendingContrastKey === contrast.contrastKey
                      ? "Ripristino..."
                      : "Ripristina"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function buttonClassName(active: boolean) {
  return active
    ? "button button--primary button--small"
    : "button button--ghost button--small";
}
