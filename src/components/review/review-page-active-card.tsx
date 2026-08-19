import {
  renderFurigana,
  stripInlineMarkdown
} from "@/features/study/ui/furigana";

import { PronunciationAudio } from "../ui/pronunciation-audio";
import {
  ReviewCardPrimaryActions,
  ReviewCardSecondaryActions
} from "./review-page-card-actions";
import { formatRemainingCardsLabel } from "./review-page-helpers";
import type {
  ReviewActiveCardActions,
  ReviewActiveCardViewModel,
  ReviewForcedContrastControl
} from "./review-page-stage-types";

export function ReviewPageActiveCard({
  actions,
  contrast,
  model
}: {
  actions: ReviewActiveCardActions;
  contrast: ReviewForcedContrastControl;
  model: ReviewActiveCardViewModel;
}) {
  const { selectedCard, viewData } = model;
  const isPrestudy = viewData.mode === "prestudy";
  const displayRemainingCount = isPrestudy
    ? viewData.selectedCardContext.remainingCount
    : model.remainingCount;

  return (
    <>
      <div className="review-stage__top">
        <div className="review-stage__chips" data-testid="review-chips">
          <span className="chip">{selectedCard.bucketLabel}</span>
          <span className="meta-pill">{selectedCard.typeLabel}</span>
          <span className="meta-pill">{selectedCard.effectiveStateLabel}</span>
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

      <ReviewCardFace
        fullSelectedCard={model.fullSelectedCard}
        isAnswerRevealed={model.isAnswerRevealed}
        onRevealAnswer={actions.handleRevealAnswer}
        selectedCard={selectedCard}
        showFrontFurigana={model.showFrontFurigana}
      />

      <ReviewCardPrimaryActions
        actions={actions}
        contrast={contrast}
        model={model}
      />

      {model.isFullReviewPageData && !isPrestudy ? (
        <ReviewCardSecondaryActions actions={actions} model={model} />
      ) : null}
    </>
  );
}

function ReviewCardFace({
  fullSelectedCard,
  isAnswerRevealed,
  onRevealAnswer,
  selectedCard,
  showFrontFurigana
}: Pick<
  ReviewActiveCardViewModel,
  "fullSelectedCard" | "isAnswerRevealed" | "selectedCard" | "showFrontFurigana"
> & {
  onRevealAnswer: () => void;
}) {
  const showCompactPronunciation = fullSelectedCard
    ? fullSelectedCard.pronunciations.length <= 1
    : false;

  return (
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
            onClick={onRevealAnswer}
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
              <p className="reader-example-sentence__jp jp-inline" lang="ja">
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
  );
}
