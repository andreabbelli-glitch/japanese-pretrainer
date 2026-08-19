import Link from "next/link";

import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/features/navigation";

import { ReviewForcedContrastAutocomplete } from "./review-forced-contrast-autocomplete";
import { reviewGradeRatingCopy } from "./review-page-helpers";
import type {
  ReviewActiveCardActions,
  ReviewActiveCardViewModel,
  ReviewForcedContrastControl
} from "./review-page-stage-types";

export function ReviewCardPrimaryActions({
  actions,
  contrast,
  model
}: {
  actions: ReviewActiveCardActions;
  contrast: ReviewForcedContrastControl;
  model: ReviewActiveCardViewModel;
}) {
  const { viewData } = model;
  const isPrestudy = viewData.mode === "prestudy";

  if (isPrestudy && model.isAnswerRevealed) {
    return <ReviewPrestudyActions model={model} />;
  }

  if (viewData.selectedCardContext.isQueueCard && model.isAnswerRevealed) {
    return (
      <>
        <ReviewForcedContrastSection
          contrast={contrast}
          isPending={model.isPending}
        />
        <div className="review-grade-grid">
          {reviewGradeRatingCopy.map((rating) => (
            <button
              key={rating.value}
              className={`review-grade-button review-grade-button--${rating.tone}`}
              disabled={model.isGradeControlsDisabled}
              type="button"
              onClick={() => actions.handleGradeCard(rating.value)}
            >
              <span>{rating.label}</span>
              <small>{rating.detail}</small>
              <small className="review-grade-button__next">
                Prossima review:{" "}
                {model.gradePreviewLookup.get(rating.value) ?? "Calcolo…"}
              </small>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (model.isHydratingFullData) {
    return (
      <div className="review-sidebar__notice">
        <p>Sto completando i dettagli della review in background.</p>
      </div>
    );
  }

  return null;
}

export function ReviewCardSecondaryActions({
  actions,
  model
}: {
  actions: ReviewActiveCardActions;
  model: ReviewActiveCardViewModel;
}) {
  const { fullSelectedCard, isPending, selectedCard, sessionHref } = model;

  return (
    <>
      {fullSelectedCard && fullSelectedCard.entries.length > 0 ? (
        <div className="review-stage__reference-actions">
          {fullSelectedCard.entries.map((entry) => (
            <Link
              key={entry.id}
              className="button button--ghost button--small"
              href={appendReturnToParam(entry.href, sessionHref)}
            >
              Apri la voce nel Glossary
            </Link>
          ))}
        </div>
      ) : null}

      <details className="review-stage__more-actions">
        <summary className="button button--ghost">Altre azioni</summary>
        <div className="review-stage__actions">
          {selectedCard.bucket === "manual" ? (
            <button
              className="button button--primary"
              disabled={isPending}
              type="button"
              onClick={actions.handleSetLearning}
            >
              Rimetti in studio
            </button>
          ) : (
            <button
              className="button button--ghost"
              disabled={isPending}
              type="button"
              onClick={actions.handleMarkKnown}
            >
              Segna già nota
            </button>
          )}

          <button
            className="button button--ghost"
            disabled={isPending}
            type="button"
            onClick={actions.handleResetCard}
          >
            Reset card
          </button>

          <button
            className="button button--ghost"
            disabled={isPending}
            type="button"
            onClick={actions.handleToggleSuspended}
          >
            {selectedCard.bucket === "suspended" ? "Riprendi" : "Sospendi"}
          </button>
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
      </details>
    </>
  );
}

function ReviewPrestudyActions({
  model
}: {
  model: ReviewActiveCardViewModel;
}) {
  const { fullSelectedCard, sessionHref, viewData } = model;
  const nextPrestudyCard = viewData.queue.advanceCards[0] ?? null;
  const nextPrestudyHref =
    nextPrestudyCard && viewData.selectedCardContext.position !== null
      ? buildCanonicalReviewSessionHrefForBase({
          answeredCount: viewData.session.answeredCount + 1,
          baseHref: viewData.media.reviewHref,
          cardId: nextPrestudyCard.id,
          isQueueCard: true,
          mode: "prestudy",
          position: viewData.selectedCardContext.position + 1,
          showAnswer: false
        })
      : null;

  return (
    <div className="review-stage__actions">
      {nextPrestudyHref ? (
        <Link className="button button--primary" href={nextPrestudyHref}>
          Prossima card
        </Link>
      ) : viewData.session.prestudy ? (
        <Link
          className="button button--primary"
          href={viewData.session.prestudy.lessonHref}
        >
          Apri la lezione
        </Link>
      ) : null}

      {nextPrestudyHref && viewData.session.prestudy ? (
        <Link
          className="button button--ghost"
          href={viewData.session.prestudy.lessonHref}
        >
          Vai al textbook
        </Link>
      ) : null}

      {fullSelectedCard
        ? fullSelectedCard.entries.map((entry) => (
            <Link
              key={entry.id}
              className="button button--ghost button--small"
              href={appendReturnToParam(entry.href, sessionHref)}
            >
              Apri Glossary
            </Link>
          ))
        : null}
    </div>
  );
}

function ReviewForcedContrastSection({
  contrast,
  isPending
}: {
  contrast: ReviewForcedContrastControl;
  isPending: boolean;
}) {
  const {
    forcedContrastInputRef,
    forcedContrastListboxId,
    forcedContrastQuery,
    forcedContrastSelection,
    forcedContrastShouldShowSuggestions,
    forcedContrastSuggestions,
    handleCloseForcedContrast,
    handleForcedContrastQueryChange,
    handleForcedContrastSelect,
    handleOpenForcedContrast,
    handleRemoveForcedContrast,
    isForcedContrastOpen
  } = contrast;

  return (
    <div className="review-stage__contrast">
      <p className="eyebrow">Contrasto</p>
      {forcedContrastSelection && !isForcedContrastOpen ? (
        <div className="review-stage__contrast-selection">
          <span className="chip">
            Contrasto con:{" "}
            <span className="jp-inline" lang="ja">
              {forcedContrastSelection.label}
            </span>
          </span>
          {forcedContrastSelection.reading ? (
            <span className="meta-pill jp-inline" lang="ja">
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
        <ReviewForcedContrastAutocomplete
          inputRef={forcedContrastInputRef}
          listboxId={forcedContrastListboxId}
          onClose={handleCloseForcedContrast}
          onQueryChange={handleForcedContrastQueryChange}
          onSelect={handleForcedContrastSelect}
          query={forcedContrastQuery}
          shouldShowSuggestions={forcedContrastShouldShowSuggestions}
          suggestions={forcedContrastSuggestions}
        />
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
  );
}
