import type { Route } from "next";
import Link from "next/link";
import type { RefObject } from "react";

import { GlossaryAutocompleteDropdown } from "@/components/glossary/glossary-autocomplete-dropdown";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/lib/glossary";
import { renderFurigana, stripInlineMarkdown } from "@/lib/render-furigana";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/lib/site";
import type { ReviewQueueCard } from "@/lib/review-types";

import { EmptyState } from "../ui/empty-state";
import { PronunciationAudio } from "../ui/pronunciation-audio";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatRemainingCardsLabel,
  formatTopUpLabel,
  reviewGradeRatingCopy,
  type ReviewGradeValue
} from "./review-page-helpers";
import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "./review-page-state";

export function ReviewPageStage({
  additionalNewCount,
  contextualGlossaryHref,
  forcedContrastInputRef,
  forcedContrastListboxId,
  forcedContrastQuery,
  forcedContrastSelection,
  forcedContrastShouldShowSuggestions,
  forcedContrastSuggestions,
  fullSelectedCard,
  gradePreviewLookup,
  handleCloseForcedContrast,
  handleForcedContrastQueryChange,
  handleForcedContrastSelect,
  handleGradeCard,
  handleMarkKnown,
  handleOpenForcedContrast,
  handleResetCard,
  handleRevealAnswer,
  handleRemoveForcedContrast,
  handleSetLearning,
  handleToggleSuspended,
  hasSupportCards,
  isAnswerRevealed,
  isForcedContrastOpen,
  isFullReviewPageData,
  isGlobalReview,
  isGradeControlsDisabled,
  isHydratingFullData,
  isPending,
  remainingCount,
  sessionHref,
  showCompletionState,
  showFrontFurigana,
  viewData
}: {
  additionalNewCount: number;
  contextualGlossaryHref: Route;
  forcedContrastInputRef: RefObject<HTMLInputElement | null>;
  forcedContrastListboxId: string;
  forcedContrastQuery: string;
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  forcedContrastShouldShowSuggestions: boolean;
  forcedContrastSuggestions: GlobalGlossaryAutocompleteSuggestion[];
  fullSelectedCard: ReviewQueueCard | null;
  gradePreviewLookup: Map<string, string>;
  handleCloseForcedContrast: () => void;
  handleForcedContrastQueryChange: (value: string) => void;
  handleForcedContrastSelect: (
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) => void;
  handleGradeCard: (rating: ReviewGradeValue) => void;
  handleMarkKnown: () => void;
  handleOpenForcedContrast: () => void;
  handleResetCard: () => void;
  handleRevealAnswer: () => void;
  handleRemoveForcedContrast: () => void;
  handleSetLearning: () => void;
  handleToggleSuspended: () => void;
  hasSupportCards: boolean;
  isAnswerRevealed: boolean;
  isForcedContrastOpen: boolean;
  isFullReviewPageData: boolean;
  isGlobalReview: boolean;
  isGradeControlsDisabled: boolean;
  isHydratingFullData: boolean;
  isPending: boolean;
  remainingCount: number;
  sessionHref: Route;
  showCompletionState: boolean;
  showFrontFurigana: boolean;
  viewData: ReviewPageClientData;
}) {
  const selectedCard = viewData.selectedCard;
  const isQueueCard = selectedCard
    ? viewData.selectedCardContext.isQueueCard
    : false;
  const showCompactPronunciation = fullSelectedCard
    ? fullSelectedCard.pronunciations.length <= 1
    : false;

  return (
    <SurfaceCard className="review-stage" variant="hero">
      {selectedCard ? (
        <>
          <div className="review-stage__top">
            <div className="review-stage__chips">
              <span className="chip">{selectedCard.bucketLabel}</span>
              <span className="meta-pill">{selectedCard.typeLabel}</span>
              <span className="meta-pill">
                {selectedCard.effectiveStateLabel}
              </span>
              {viewData.scope === "global" ? (
                <span className="meta-pill">{selectedCard.mediaTitle}</span>
              ) : null}
              {selectedCard.segmentTitle ? (
                <span className="meta-pill">{selectedCard.segmentTitle}</span>
              ) : null}
            </div>
            {remainingCount > 0 ? (
              <p className="review-stage__position">
                {formatRemainingCardsLabel(remainingCount)}
              </p>
            ) : null}
          </div>

          <div className="review-stage__card">
            <p className="eyebrow">Fronte</p>
            <h2 className="review-stage__front jp-inline">
              {showFrontFurigana
                ? renderFurigana(selectedCard.front)
                : stripInlineMarkdown(selectedCard.front)}
            </h2>
            {!isAnswerRevealed ? (
              <div className="review-stage__veil">
                <button
                  className="button button--primary review-stage__reveal"
                  type="button"
                  onClick={handleRevealAnswer}
                >
                  Mostra risposta
                </button>
              </div>
            ) : (
              <div className="review-stage__answer">
                <p className="eyebrow">Retro</p>
                {selectedCard.reading ? (
                  <p className="review-stage__reading jp-inline">
                    {selectedCard.reading}
                  </p>
                ) : null}
                <p className="review-stage__back">{selectedCard.back}</p>
                {fullSelectedCard && fullSelectedCard.pronunciations.length > 0 ? (
                  <div className="stack-list stack-list--tight">
                    {showCompactPronunciation ? (
                      <p className="eyebrow">Pronuncia</p>
                    ) : null}
                    {fullSelectedCard.pronunciations.map((item) => (
                      <PronunciationAudio
                        key={`${item.kind}:${item.label}:${item.audio.src ?? item.audio.pitchAccent?.downstep ?? "no-audio"}`}
                        audio={item.audio}
                        compact={showCompactPronunciation}
                        preload="metadata"
                        title={`${item.relationshipLabel} · ${item.label}`}
                      />
                    ))}
                  </div>
                ) : null}
                {selectedCard.exampleJp && selectedCard.exampleIt ? (
                  <section className="reader-example-sentence">
                    <p className="reader-example-sentence__jp jp-inline">
                      {renderFurigana(selectedCard.exampleJp)}
                    </p>
                    <details className="reader-example-sentence__translation">
                      <summary>Mostra traduzione italiana</summary>
                      <div className="reader-example-sentence__translation-body">
                        <p>{renderFurigana(selectedCard.exampleIt)}</p>
                      </div>
                    </details>
                  </section>
                ) : null}
                {selectedCard.notes ? (
                  <p className="review-stage__notes">
                    {renderFurigana(selectedCard.notes)}
                  </p>
                ) : null}
                {fullSelectedCard && fullSelectedCard.contexts.length > 1 ? (
                  <div className="stack-list stack-list--tight">
                    <p className="eyebrow">Compare anche in</p>
                    {fullSelectedCard.contexts.slice(0, 4).map((context) => (
                      <p key={context.cardId} className="review-stage__meta">
                        <strong>{context.mediaTitle}</strong>
                        {context.segmentTitle ? ` · ${context.segmentTitle}` : ""}
                        {`: ${context.front}`}
                      </p>
                    ))}
                  </div>
                ) : null}
                {selectedCard.dueLabel ? (
                  <p className="review-stage__meta">{selectedCard.dueLabel}</p>
                ) : null}
              </div>
            )}
          </div>

          {isQueueCard && isAnswerRevealed ? (
            <>
              <div className="review-stage__contrast">
                <p className="eyebrow">Contrasto</p>
                {forcedContrastSelection && !isForcedContrastOpen ? (
                  <div className="review-stage__contrast-selection">
                    <span className="chip">
                      Contrasto con:{" "}
                      <span className="jp-inline">{forcedContrastSelection.label}</span>
                    </span>
                    {forcedContrastSelection.reading ? (
                      <span className="meta-pill jp-inline">
                        {forcedContrastSelection.reading}
                      </span>
                    ) : null}
                    <span className="review-stage__meta">
                      {forcedContrastSelection.meaning}
                    </span>
                    <button
                      className="button button--ghost button--small"
                      disabled={isPending}
                      type="button"
                      onClick={handleOpenForcedContrast}
                    >
                      Cambia
                    </button>
                    <button
                      className="button button--ghost button--small"
                      disabled={isPending}
                      type="button"
                      onClick={handleRemoveForcedContrast}
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : isForcedContrastOpen ? (
                  <div className="glossary-autocomplete">
                    <input
                      ref={forcedContrastInputRef}
                      aria-autocomplete="list"
                      aria-controls={
                        forcedContrastShouldShowSuggestions
                          ? forcedContrastListboxId
                          : undefined
                      }
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect="off"
                      className="glossary-search-form__input"
                      enterKeyHint="search"
                      inputMode="search"
                      onBlur={handleCloseForcedContrast}
                      onChange={(event) => {
                        handleForcedContrastQueryChange(event.currentTarget.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          handleCloseForcedContrast();
                        }
                      }}
                      placeholder="待つ, まつ, matsu, aspettare"
                      spellCheck={false}
                      type="search"
                      value={forcedContrastQuery}
                    />
                    <GlossaryAutocompleteDropdown
                      listboxId={forcedContrastListboxId}
                      onSelect={handleForcedContrastSelect}
                      shouldShowSuggestions={forcedContrastShouldShowSuggestions}
                      suggestions={forcedContrastSuggestions}
                    />
                  </div>
                ) : (
                  <button
                    className="button button--ghost button--small"
                    disabled={isPending}
                    type="button"
                    onClick={handleOpenForcedContrast}
                  >
                    + Contrasto
                  </button>
                )}
              </div>

              <div className="review-grade-grid">
                {reviewGradeRatingCopy.map((rating) => (
                  <button
                    key={rating.value}
                    className={`review-grade-button review-grade-button--${rating.tone}`}
                    disabled={isGradeControlsDisabled}
                    type="button"
                    onClick={() => handleGradeCard(rating.value)}
                  >
                    <span>{rating.label}</span>
                    <small>{rating.detail}</small>
                    <small className="review-grade-button__next">
                      Prossima review: {gradePreviewLookup.get(rating.value) ?? "n/d"}
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : isHydratingFullData ? (
            <div className="review-sidebar__notice">
              <p>Sto completando i dettagli della review in background.</p>
            </div>
          ) : null}

          {isFullReviewPageData ? (
            <>
              <div className="review-stage__actions">
                {selectedCard.bucket === "manual" ? (
                  <button
                    className="button button--primary"
                    disabled={isPending}
                    type="button"
                    onClick={handleSetLearning}
                  >
                    Rimetti in studio
                  </button>
                ) : (
                  <button
                    className="button button--ghost"
                    disabled={isPending}
                    type="button"
                    onClick={handleMarkKnown}
                  >
                    Segna già nota
                  </button>
                )}

                <button
                  className="button button--ghost"
                  disabled={isPending}
                  type="button"
                  onClick={handleResetCard}
                >
                  Reset card
                </button>

                <button
                  className="button button--ghost"
                  disabled={isPending}
                  type="button"
                  onClick={handleToggleSuspended}
                >
                  {selectedCard.bucket === "suspended" ? "Riprendi" : "Sospendi"}
                </button>

                {fullSelectedCard
                  ? fullSelectedCard.entries.map((entry) => (
                      <Link
                        key={entry.id}
                        className="button button--ghost button--small"
                        href={appendReturnToParam(entry.href, sessionHref)}
                      >
                        Apri la voce nel Glossary
                      </Link>
                    ))
                  : null}
              </div>

              {selectedCard.bucket === "manual" ? (
                <p className="review-stage__hint">
                  Lo stato manuale si applica alle voci collegate: la card resta
                  intatta e riprende il suo scheduling appena la rimetti in studio.
                </p>
              ) : selectedCard.bucket === "suspended" ? (
                <p className="review-stage__hint">
                  La sospensione usa lo stato della card, non cancella intervalli o
                  log già presenti.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      ) : showCompletionState ? (
        <EmptyState
          title={
            isGlobalReview
              ? viewData.session.answeredCount > 0
                ? "Sessione chiusa, ora sei in pari su tutta la Review."
                : "Oggi sei in pari su tutta la Review."
              : viewData.session.answeredCount > 0
                ? "Sessione chiusa, ora sei in pari."
                : "Oggi sei in pari."
          }
          description={
            additionalNewCount > 0
              ? isGlobalReview
                ? `La coda di oggi è finita. Puoi chiudere qui oppure aggiungere subito altre ${additionalNewCount} nuove${additionalNewCount === 1 ? "" : " card"} alla rotazione attuale della review globale.`
                : `La coda di oggi è finita. Puoi chiudere qui oppure aggiungere subito altre ${additionalNewCount} nuove${additionalNewCount === 1 ? "" : " card"} alla rotazione attuale di questo media.`
              : hasSupportCards
                ? "La coda di oggi non richiede altre risposte. Se ti serve intervenire su card già note, sospese o fuori finestra, puoi farlo dal Glossary o dalle impostazioni di studio."
                : isGlobalReview
                  ? "La review globale non ha ancora card da lavorare o mantenere adesso."
                  : "Per questo media non ci sono altre card da lavorare o mantenere adesso."
          }
          action={
            <>
              {additionalNewCount > 0 ? (
                <Link
                  className="button button--primary"
                  href={buildCanonicalReviewSessionHrefForBase({
                    answeredCount: viewData.session.answeredCount,
                    baseHref: viewData.media.reviewHref,
                    extraNewCount:
                      viewData.session.extraNewCount + additionalNewCount,
                    isQueueCard: true,
                    position: 1,
                    segmentId: viewData.session.segmentId
                  })}
                >
                  {formatTopUpLabel(additionalNewCount)}
                </Link>
              ) : null}
              <Link className="button button--ghost" href={contextualGlossaryHref}>
                Apri Glossary
              </Link>
            </>
          }
        />
      ) : (
        <EmptyState
          title={
            isGlobalReview
              ? "Nessuna card pronta nella review globale."
              : "Nessuna card da gestire."
          }
          description={
            isGlobalReview
              ? "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso della review globale."
              : "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso di Review del media."
          }
          action={
            <Link className="button button--ghost" href={contextualGlossaryHref}>
              Apri Glossary
            </Link>
          }
        />
      )}
    </SurfaceCard>
  );
}
