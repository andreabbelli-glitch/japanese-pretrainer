import type { Route } from "next";
import Link from "next/link";

import type { GlossarySearchResult } from "@/features/glossary/types";
import { appendReturnToParam } from "@/lib/site";

import { HighlightText } from "./glossary-highlight-text";
import { PronunciationAudio } from "../ui/pronunciation-audio";
import { SurfaceCard } from "../ui/surface-card";

type GlobalGlossaryResultCardProps = {
  entry: GlossarySearchResult;
  query: string;
  returnTo?: Route;
};

export function GlobalGlossaryResultCard({
  entry,
  query,
  returnTo
}: GlobalGlossaryResultCardProps) {
  const visibleAliasMatches = entry.matchedFields.aliases.filter(
    (alias) =>
      ![entry.label, entry.title, entry.reading, entry.romaji]
        .filter(Boolean)
        .includes(alias.text)
  );
  const visibleMediaHits = entry.mediaHits.slice(0, 3);
  const overflowMediaCount = entry.mediaHits.length - visibleMediaHits.length;

  return (
    <SurfaceCard className="glossary-result-card glossary-result-card--portal">
      <div className="glossary-result-card__top">
        <div className="glossary-result-card__chips">
          <span className={`chip${entry.kind === "grammar" ? " chip--grammar" : ""}`}>
            {entry.kind === "term" ? "Termine" : "Grammatica"}
          </span>
          {!entry.hasCards ? (
            <span className="meta-pill">Senza flashcard</span>
          ) : null}
          <span className="meta-pill">{entry.studyState.label}</span>
          <span className="meta-pill">
            {entry.mediaCount === 1 ? "1 media" : `${entry.mediaCount} media`}
          </span>
        </div>
      </div>

      <div className="glossary-global-result__copy">
        <h3 className="glossary-result-card__title jp-inline">
          <HighlightText
            mode={entry.matchedFields.label}
            query={query}
            text={entry.label}
          />
        </h3>
        {entry.title && entry.title !== entry.label ? (
          <p className="glossary-result-card__subtitle">
            <HighlightText
              mode={entry.matchedFields.title}
              query={query}
              text={entry.title}
            />
          </p>
        ) : null}
        {entry.reading || entry.romaji ? (
          <p className="glossary-result-card__reading jp-inline">
            {entry.reading ? (
              <HighlightText
                mode={entry.matchedFields.reading}
                query={query}
                text={entry.reading}
              />
            ) : null}
            {entry.reading && entry.romaji ? " / " : null}
            {entry.romaji ? (
              <HighlightText
                mode={entry.matchedFields.romaji}
                query={query}
                text={entry.romaji}
              />
            ) : null}
          </p>
        ) : null}
        {entry.pronunciation ? (
          <PronunciationAudio audio={entry.pronunciation} compact />
        ) : null}
        <p className="glossary-result-card__meaning">
          <HighlightText
            mode={entry.matchedFields.meaning}
            query={query}
            text={entry.meaning}
          />
        </p>
      </div>

      {entry.matchBadges.length > 0 || visibleAliasMatches.length > 0 ? (
        <div className="glossary-result-card__match">
          {entry.matchBadges.map((badge) => (
            <span key={badge} className="chip">
              Match: {badge}
            </span>
          ))}
          {visibleAliasMatches.length > 0 ? (
            <p className="glossary-result-card__match-preview">
              Alias:{" "}
              {visibleAliasMatches.map((alias, index) => (
                <span key={`${alias.text}-${alias.mode}`}>
                  {index > 0 ? ", " : null}
                  <HighlightText
                    mode={alias.mode}
                    query={query}
                    text={alias.text}
                  />
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="glossary-result-card__footer">
        <div className="glossary-result-card__meta">
          <span>{entry.cardCount === 1 ? "1 flashcard" : `${entry.cardCount} flashcard`}</span>
          <span>{entry.mediaCount === 1 ? "1 media collegato" : `${entry.mediaCount} media collegati`}</span>
          <span>
            {entry.mediaHits.length === 1
              ? "1 variante locale"
              : `${entry.mediaHits.length} varianti locali`}
          </span>
        </div>

        <div className="glossary-global-result__media">
          <p className="glossary-global-result__media-label">
            Aprila in
          </p>
          <div className="glossary-global-result__media-hits">
            {visibleMediaHits.map((hit) => (
              <Link
                aria-label={`Apri ${entry.label} in ${hit.mediaTitle}${
                  hit.segmentTitle ? `, segmento ${hit.segmentTitle}` : ""
                }`}
                key={`${hit.mediaSlug}:${hit.internalId}`}
                className={`glossary-global-result__media-link ${
                  hit.isBestLocal ? "status-pill" : "meta-pill"
                }`}
                href={appendReturnToParam(hit.href, returnTo)}
              >
                {hit.mediaTitle}
                {hit.segmentTitle ? ` · ${hit.segmentTitle}` : ""}
                {hit.isBestLocal ? " · consigliato" : ""}
              </Link>
            ))}
            {overflowMediaCount > 0 ? (
              <span className="meta-pill">+{overflowMediaCount} altri media</span>
            ) : null}
          </div>
        </div>

      </div>
    </SurfaceCard>
  );
}
