import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState, type RefObject } from "react";

import {
  getNextGlossaryAutocompleteIndex,
  GlossaryAutocompleteDropdown
} from "@/features/glossary/ui/client/glossary-autocomplete-dropdown";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";
import type { ReviewQueueCard } from "@/features/review/client";
import {
  renderFurigana,
  stripInlineMarkdown
} from "@/features/study/ui/furigana";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/features/navigation";

import { EmptyState } from "../ui/empty-state";
import { PronunciationAudio } from "../ui/pronunciation-audio";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatRemainingCardsLabel,
  formatTopUpLabel,
  resolveReviewQueueRefreshState,
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
  handleRefreshQueue,
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
  handleRefreshQueue: () => void;
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
  const isPrestudy = viewData.mode === "prestudy";
  const isQueueCard = selectedCard
    ? viewData.selectedCardContext.isQueueCard
    : false;
  const showCompactPronunciation = fullSelectedCard
    ? fullSelectedCard.pronunciations.length <= 1
    : false;
  const nextPrestudyCard = isPrestudy
    ? (viewData.queue.advanceCards[0] ?? null)
    : null;
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
  const displayRemainingCount = isPrestudy
    ? viewData.selectedCardContext.remainingCount
    : remainingCount;

  return (
    <SurfaceCard className="review-stage" testId="review-stage" variant="hero">
      {selectedCard ? (
        <>
          <div className="review-stage__top">
            <div className="review-stage__chips" data-testid="review-chips">
              <span className="chip">{selectedCard.bucketLabel}</span>
              <span className="meta-pill">{selectedCard.typeLabel}</span>
              <span className="meta-pill">
                {selectedCard.effectiveStateLabel}
              </span>
              {viewData.scope === "global" ? (
                <span className="meta-pill">{selectedCard.mediaTitle}</span>
              ) : null}
              {viewData.session.prestudy ? (
                <span className="meta-pill">
                  {viewData.session.prestudy.lessonTitle}
                </span>
              ) : null}
              {selectedCard.segmentTitle ? (
                <span className="meta-pill">{selectedCard.segmentTitle}</span>
              ) : null}
            </div>
            {displayRemainingCount > 0 ? (
              <p className="review-stage__position">
                {formatRemainingCardsLabel(displayRemainingCount)}
              </p>
            ) : null}
          </div>

          <div className="review-stage__card">
            <p className="eyebrow">Fronte</p>
            <h2 className="review-stage__front jp-inline" lang="ja">
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
              <div className="review-stage__answer" data-testid="review-answer">
                <p className="eyebrow">Retro</p>
                {selectedCard.reading ? (
                  <p className="review-stage__reading jp-inline" lang="ja">
                    {selectedCard.reading}
                  </p>
                ) : null}
                <p className="review-stage__back">
                  {renderFurigana(selectedCard.back)}
                </p>
                {fullSelectedCard &&
                fullSelectedCard.pronunciations.length > 0 ? (
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
                    <p
                      className="reader-example-sentence__jp jp-inline"
                      lang="ja"
                    >
                      {renderFurigana(selectedCard.exampleJp)}
                    </p>
                    {selectedCard.exampleAudio ? (
                      <PronunciationAudio
                        audio={selectedCard.exampleAudio}
                        preload="metadata"
                        showPitchAccent={false}
                        title="Audio frase"
                      />
                    ) : null}
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
                        {context.segmentTitle
                          ? ` · ${context.segmentTitle}`
                          : ""}
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

          {isPrestudy && isAnswerRevealed ? (
            <div className="review-stage__actions">
              {nextPrestudyHref ? (
                <Link
                  className="button button--primary"
                  href={nextPrestudyHref}
                >
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
          ) : isQueueCard && isAnswerRevealed ? (
            <>
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
                      Prossima review:{" "}
                      {gradePreviewLookup.get(rating.value) ?? "Calcolo…"}
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

          {isFullReviewPageData && !isPrestudy ? (
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
                    {selectedCard.bucket === "suspended"
                      ? "Riprendi"
                      : "Sospendi"}
                  </button>
                </div>

                {selectedCard.bucket === "manual" ? (
                  <p className="review-stage__hint">
                    Lo stato manuale si applica alle voci collegate: la card
                    resta intatta e riprende il suo scheduling appena la rimetti
                    in studio.
                  </p>
                ) : selectedCard.bucket === "suspended" ? (
                  <p className="review-stage__hint">
                    La sospensione usa lo stato della card, non cancella
                    intervalli o log già presenti.
                  </p>
                ) : null}
              </details>
            </>
          ) : null}
        </>
      ) : showCompletionState ? (
        <EmptyState
          title={
            isPrestudy
              ? "Non ci sono card di prestudy per la prossima lezione."
              : isGlobalReview
                ? viewData.session.answeredCount > 0
                  ? "Sessione chiusa, ora sei in pari su tutta la Review."
                  : "Oggi sei in pari su tutta la Review."
                : viewData.session.answeredCount > 0
                  ? "Sessione chiusa, ora sei in pari."
                  : "Oggi sei in pari."
          }
          description={
            isPrestudy
              ? "Quando la prossima lezione con card attive sarà disponibile, questa modalità mostrerà automaticamente quelle card."
              : additionalNewCount > 0
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
                    extraNewAnchorCount: viewData.session.extraNewAnchorCount,
                    extraNewCount:
                      viewData.session.extraNewCount + additionalNewCount,
                    isQueueCard: true,
                    mode: viewData.mode,
                    position: 1,
                    segmentId: viewData.session.segmentId
                  })}
                >
                  {formatTopUpLabel(additionalNewCount)}
                </Link>
              ) : null}
              {!isPrestudy ? (
                <ReviewQueueRefreshButton
                  key={viewData.queue.nextDueAt ?? "no-next-due"}
                  isPending={isPending}
                  nextDueAt={viewData.queue.nextDueAt ?? null}
                  onRefresh={handleRefreshQueue}
                />
              ) : null}
              <Link
                className="button button--ghost"
                href={contextualGlossaryHref}
              >
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
            <Link
              className="button button--ghost"
              href={contextualGlossaryHref}
            >
              Apri Glossary
            </Link>
          }
        />
      )}
    </SurfaceCard>
  );
}

export function ReviewForcedContrastAutocomplete({
  inputRef,
  listboxId,
  onClose,
  onQueryChange,
  onSelect,
  query,
  shouldShowSuggestions,
  suggestions
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listboxId: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (suggestion: GlobalGlossaryAutocompleteSuggestion) => void;
  query: string;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const resolvedActiveIndex =
    shouldShowSuggestions &&
    activeIndex >= 0 &&
    activeIndex < suggestions.length
      ? activeIndex
      : -1;
  const activeDescendant =
    resolvedActiveIndex >= 0
      ? `${listboxId}-option-${resolvedActiveIndex}`
      : undefined;

  const close = () => {
    setActiveIndex(-1);
    onClose();
  };

  const select = (suggestion: GlobalGlossaryAutocompleteSuggestion) => {
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  return (
    <div className="glossary-autocomplete">
      <label className="sr-only" htmlFor="review-forced-contrast-query">
        Cerca una card di contrasto
      </label>
      <input
        ref={inputRef}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-controls={shouldShowSuggestions ? listboxId : undefined}
        aria-expanded={shouldShowSuggestions}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        className="glossary-search-form__input"
        enterKeyHint="search"
        id="review-forced-contrast-query"
        inputMode="search"
        onBlur={close}
        onChange={(event) => {
          setActiveIndex(-1);
          onQueryChange(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!shouldShowSuggestions) {
              return;
            }

            event.preventDefault();
            setActiveIndex((currentIndex) =>
              getNextGlossaryAutocompleteIndex({
                currentIndex,
                direction: event.key === "ArrowDown" ? "next" : "previous",
                suggestionCount: suggestions.length
              })
            );
            return;
          }

          if (event.key === "Enter" && resolvedActiveIndex >= 0) {
            const activeSuggestion = suggestions[resolvedActiveIndex];

            if (activeSuggestion) {
              event.preventDefault();
              select(activeSuggestion);
            }
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        placeholder="待つ, まつ, matsu, aspettare"
        role="combobox"
        spellCheck={false}
        type="search"
        value={query}
      />
      <GlossaryAutocompleteDropdown
        activeIndex={resolvedActiveIndex}
        listboxId={listboxId}
        onActiveIndexChange={setActiveIndex}
        onSelect={select}
        shouldShowSuggestions={shouldShowSuggestions}
        suggestions={suggestions}
      />
    </div>
  );
}

function ReviewQueueRefreshButton({
  isPending,
  nextDueAt,
  onRefresh
}: {
  isPending: boolean;
  nextDueAt: string | null;
  onRefresh: () => void;
}) {
  const now = useReviewQueueRefreshClock({
    nextDueAt
  });
  const queueRefreshState = resolveReviewQueueRefreshState({
    isPending,
    nextDueAt,
    now
  });

  return (
    <>
      <button
        className="button button--primary"
        disabled={!queueRefreshState.canRefresh}
        type="button"
        onClick={onRefresh}
      >
        {queueRefreshState.buttonLabel}
      </button>
      <p className="review-stage__hint">{queueRefreshState.statusLabel}</p>
    </>
  );
}

function useReviewQueueRefreshClock(input: { nextDueAt: string | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!input.nextDueAt) {
      return;
    }

    const dueTime = new Date(input.nextDueAt).getTime();
    const msUntilDue = dueTime - now.getTime();

    if (!Number.isFinite(msUntilDue) || msUntilDue <= 0) {
      return;
    }

    const timeout = window.setTimeout(
      () => setNow(new Date()),
      Math.max(1_000, Math.min(msUntilDue, 60_000))
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [input.nextDueAt, now]);

  return now;
}
