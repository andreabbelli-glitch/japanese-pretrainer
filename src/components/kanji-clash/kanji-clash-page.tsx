"use client";

import Link from "next/link";
import type { TouchEventHandler } from "react";

import type {
  KanjiClashEligibleSubject,
  KanjiClashPageData,
  KanjiClashQueueSnapshot,
  KanjiClashSessionRound
} from "@/lib/kanji-clash/types";
import { cx } from "@/lib/classnames";
import { kanjiClashHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatKanjiClashModeLabel,
  formatKanjiClashPairStateLabel,
  formatKanjiClashRoundPosition,
  formatKanjiClashRoundSource,
  getKanjiClashSubjectMeaning,
  getKanjiClashSubjectReading
} from "./kanji-clash-format";
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
    data.selectedMedia?.slug ?? "global",
    data.queue.requestedSize ?? "auto",
    data.queue.totalCount,
    data.currentRound?.pairKey ?? "empty"
  ].join(":");

  return <KanjiClashPageClient key={controllerKey} data={data} />;
}

function KanjiClashPageClient({ data }: KanjiClashPageProps) {
  const controller = useKanjiClashRoundController(data);

  return (
    <div className="kanji-clash-page">
      <StickyPageHeader
        eyebrow="Kanji Clash"
        title="Workspace di confronto"
        summary={buildHeaderSummary(
          data,
          controller.queue,
          controller.currentRound
        )}
        actions={
          <div className="hero-actions">
            <Link
              aria-current={data.mode === "automatic" ? "page" : undefined}
              className={buttonClassName(data.mode === "automatic")}
              href={buildModeHref(data, "automatic")}
            >
              Automatico
            </Link>
            <Link
              aria-current={data.mode === "manual" ? "page" : undefined}
              className={buttonClassName(data.mode === "manual")}
              href={buildModeHref(data, "manual")}
            >
              Drill manuale
            </Link>
          </div>
        }
      />

      <section className="hero-grid hero-grid--detail kanji-clash-workspace">
        {controller.currentRound ? (
          <KanjiClashRoundWorkspace
            clientError={controller.clientError}
            data={data}
            feedback={controller.feedback}
            isSelectionLocked={controller.isSelectionLocked}
            onChooseSide={controller.handleChooseSide}
            onContinue={controller.handleContinue}
            onTouchEnd={controller.handleTouchEnd}
            onTouchStart={controller.handleTouchStart}
            queue={controller.queue}
            round={controller.currentRound}
          />
        ) : (
          <KanjiClashEmptyWorkspace data={data} queue={controller.queue} />
        )}

        <KanjiClashSidebar data={data} queue={controller.queue} />
      </section>
    </div>
  );
}

function KanjiClashRoundWorkspace({
  clientError,
  data,
  feedback,
  isSelectionLocked,
  onChooseSide,
  onContinue,
  onTouchEnd,
  onTouchStart,
  queue,
  round
}: {
  clientError: string | null;
  data: KanjiClashPageData;
  feedback: KanjiClashRoundFeedback | null;
  isSelectionLocked: boolean;
  onChooseSide: (side: "left" | "right") => void;
  onContinue: () => void;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchStart: TouchEventHandler<HTMLElement>;
  queue: KanjiClashQueueSnapshot;
  round: KanjiClashSessionRound;
}) {
  const feedbackCopy = feedback ? buildFeedbackCopy(feedback) : null;
  const targetNote = feedback
    ? feedback.status === "correct"
      ? queue.currentRoundIndex + 1 >= queue.totalCount
        ? "Hai chiuso la coda corrente. La schermata finale arriva tra un attimo."
        : "Hai trovato la risposta giusta. Il prossimo round parte tra poco."
      : "La risposta corretta è già rivelata. Premi Continua per passare al round successivo."
    : "Scegli quale forma giapponese corrisponde al target.";

  return (
    <article
      className="surface-card surface-card--hero kanji-clash-stage"
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
          <p className="kanji-clash-stage__summary">
            Il target centrale mostra lettura e significato. Le due opzioni ai
            lati restano superfici giapponesi pure da distinguere al volo.
          </p>
        </div>
        <div className="kanji-clash-stage__chips">
          <span className="chip">{formatKanjiClashRoundSource(round.source)}</span>
          <span className="meta-pill">{formatScopeLabel(data)}</span>
          {round.pairState ? (
            <span className="meta-pill">
              {formatKanjiClashPairStateLabel(round.pairState.state)}
            </span>
          ) : null}
          {feedback ? (
            <span
              className={cx(
                "meta-pill",
                feedback.status === "correct"
                  ? "kanji-clash-feedback-pill--correct"
                  : "kanji-clash-feedback-pill--incorrect"
              )}
            >
              {feedback.status === "correct" ? "Corretto" : "Conferma richiesta"}
            </span>
          ) : isSelectionLocked ? (
            <span className="meta-pill">Controllo risposta...</span>
          ) : null}
        </div>
      </div>

      <div className="kanji-clash-round-grid">
        <KanjiClashOptionCard
          disabled={isSelectionLocked}
          feedback={feedback}
          label="Opzione sinistra"
          onSelect={() => onChooseSide("left")}
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
          {round.candidate.sharedKanji.length > 0 ? (
            <div className="kanji-clash-target__chips">
              {round.candidate.sharedKanji.map((kanji) => (
                <span key={kanji} className="chip">
                  {kanji}
                </span>
              ))}
            </div>
          ) : null}
          <p className="kanji-clash-target__note">{targetNote}</p>
        </SurfaceCard>

        <KanjiClashOptionCard
          disabled={isSelectionLocked}
          feedback={feedback}
          label="Opzione destra"
          onSelect={() => onChooseSide("right")}
          side="right"
          subject={round.right}
        />
      </div>

      {feedbackCopy ? (
        <div
          aria-live={feedback?.status === "incorrect" ? "assertive" : "polite"}
          className={cx(
            "kanji-clash-feedback",
            feedback?.status === "correct"
              ? "kanji-clash-feedback--correct"
              : "kanji-clash-feedback--incorrect"
          )}
          role={feedback?.status === "incorrect" ? "alert" : "status"}
        >
          <p className="kanji-clash-feedback__title">{feedbackCopy.title}</p>
          <p className="kanji-clash-feedback__summary">
            {feedbackCopy.description}
          </p>
          {feedback?.status === "incorrect" ? (
            <button
              className="button button--primary button--small"
              onClick={onContinue}
              type="button"
            >
              {feedback.nextRound ? "Continua" : "Chiudi sessione"}
            </button>
          ) : (
            <span className="meta-pill">Avanzo automatico</span>
          )}
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
  label,
  onSelect,
  side,
  subject
}: {
  disabled: boolean;
  feedback: KanjiClashRoundFeedback | null;
  label: string;
  onSelect: () => void;
  side: "left" | "right";
  subject: KanjiClashEligibleSubject;
}) {
  const isSelected = feedback?.selectedSide === side;
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
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <p className="eyebrow">{label}</p>
      <h3 className="kanji-clash-option__surface jp-inline">
        {subject.surfaceForms[0] ?? subject.label}
      </h3>
      <p className="kanji-clash-option__caption">
        Forma giapponese da confrontare visivamente con il target centrale.
      </p>
      {badgeLabel ? (
        <span className="kanji-clash-option__badge meta-pill">{badgeLabel}</span>
      ) : null}
    </button>
  );
}

function KanjiClashEmptyWorkspace({
  data,
  queue
}: {
  data: KanjiClashPageData;
  queue: KanjiClashQueueSnapshot;
}) {
  const completedSession = queue.finished || queue.totalCount > 0;

  return (
    <EmptyState
      eyebrow="Kanji Clash"
      title={
        completedSession
          ? "Sessione completata"
          : data.selectedMedia
            ? `Nessun confronto pronto in ${data.selectedMedia.title}`
            : "Nessun confronto disponibile"
      }
      description={
        completedSession
          ? "Hai chiuso la coda corrente. Puoi cambiare modalità, allargare lo scope o aprire un drill manuale diverso."
          : data.selectedMedia
            ? "Questo filtro media non produce ancora coppie eleggibili. Torna al globale oppure prova l'altra modalità."
            : "Non ci sono ancora coppie eleggibili per questo scope. Cambia modalità o restringi a un media specifico."
      }
      action={
        <div className="empty-state__action">
          <Link
            className="button button--primary"
            href={
              data.selectedMedia
                ? buildMediaHref(data, null)
                : buildModeHref(
                    data,
                    data.mode === "automatic" ? "manual" : "automatic"
                  )
            }
          >
            {data.selectedMedia
              ? "Torna al globale"
              : data.mode === "automatic"
                ? "Apri drill manuale"
                : "Apri automatico"}
          </Link>
          {data.selectedMedia ? (
            <Link
              className="button button--ghost"
              href={buildModeHref(
                data,
                data.mode === "automatic" ? "manual" : "automatic"
              )}
            >
              Cambia modalità
            </Link>
          ) : null}
        </div>
      }
    />
  );
}

function KanjiClashSidebar({
  data,
  queue
}: {
  data: KanjiClashPageData;
  queue: KanjiClashQueueSnapshot;
}) {
  const manualSize = queue.requestedSize ?? data.settings.manualDefaultSize;

  return (
    <SurfaceCard className="kanji-clash-sidebar" variant="quiet">
      <div className="kanji-clash-sidebar__copy">
        <p className="eyebrow">Contesto</p>
        <h2 className="kanji-clash-sidebar__title">
          {formatKanjiClashModeLabel(data.mode)}
        </h2>
        <p className="kanji-clash-sidebar__summary">
          {data.mode === "automatic"
            ? `Prima le coppie dovute, poi nuove coppie fino al cap giornaliero di ${data.settings.dailyNewLimit}.`
            : `Sessione finita con taglia ${manualSize}, costruita sullo stesso pool eleggibile.`}
        </p>
      </div>

      <div className="stats-grid stats-grid--compact">
        <StatBlock
          detail={
            data.selectedMedia
              ? data.selectedMedia.title
              : "Tutto il catalogo disponibile"
          }
          label="Ambito"
          value={data.selectedMedia ? "Media" : "Globale"}
        />
        <StatBlock
          detail="Round costruiti nella sessione corrente."
          label="In coda"
          value={String(queue.totalCount)}
        />
        <StatBlock
          detail="Round ancora da giocare da qui in avanti."
          label="Rimanenti"
          tone={queue.remainingCount > 0 ? "warning" : "default"}
          value={String(queue.remainingCount)}
        />
        <StatBlock
          detail={
            data.mode === "automatic"
              ? `${queue.introducedTodayCount}/${data.settings.dailyNewLimit} introdotte oggi.`
              : `${manualSize} round richiesti nel drill.`
          }
          label="Nuove"
          value={String(queue.newQueuedCount)}
        />
      </div>

      <div className="kanji-clash-sidebar__controls">
        <div>
          <p className="eyebrow">Filtro media</p>
          <div className="hero-actions">
            <Link
              aria-current={data.selectedMedia === null ? "page" : undefined}
              className={buttonClassName(data.selectedMedia === null)}
              href={buildMediaHref(data, null)}
            >
              Globale
            </Link>
            {data.availableMedia.map((media) => (
              <Link
                key={media.id}
                aria-current={
                  data.selectedMedia?.slug === media.slug ? "page" : undefined
                }
                className={buttonClassName(
                  data.selectedMedia?.slug === media.slug
                )}
                href={buildMediaHref(data, media.slug)}
              >
                {media.title}
              </Link>
            ))}
          </div>
        </div>

        {data.mode === "manual" ? (
          <div>
            <p className="eyebrow">Dimensione sessione</p>
            <div className="hero-actions">
              {data.settings.manualSizeOptions.map((size) => (
                <Link
                  key={size}
                  aria-current={manualSize === size ? "page" : undefined}
                  className={buttonClassName(manualSize === size)}
                  href={buildSizeHref(data, size)}
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="kanji-clash-sidebar__note">
            Le nuove coppie restano separate dalla review standard e contano
            solo nel workspace Kanji Clash.
          </p>
        )}
      </div>
    </SurfaceCard>
  );
}

function buildHeaderSummary(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot,
  currentRound: KanjiClashSessionRound | null
) {
  const scopeLabel = formatScopeLabel(data);

  if (!currentRound) {
    return queue.finished || queue.totalCount > 0
      ? "La coda corrente è completa. Cambia filtro o modalità per aprire il prossimo workspace."
      : `Scope ${scopeLabel}. Nessuna coppia pronta al momento.`;
  }

  return data.mode === "automatic"
    ? `Scope ${scopeLabel}. Target centrale, due opzioni laterali e coda dedicata separata dalla review classica.`
    : `Scope ${scopeLabel}. Drill manuale con target centrale e confronto laterale già materializzati dal loader.`;
}

function buildModeHref(data: KanjiClashPageData, mode: "automatic" | "manual") {
  return kanjiClashHref({
    media: data.selectedMedia?.slug,
    mode,
    size:
      mode === "manual"
        ? (data.queue.requestedSize ?? data.settings.manualDefaultSize)
        : undefined
  });
}

function buildMediaHref(data: KanjiClashPageData, mediaSlug: string | null) {
  return kanjiClashHref({
    media: mediaSlug ?? undefined,
    mode: data.mode,
    size:
      data.mode === "manual"
        ? (data.queue.requestedSize ?? data.settings.manualDefaultSize)
        : undefined
  });
}

function buildSizeHref(data: KanjiClashPageData, size: number) {
  return kanjiClashHref({
    media: data.selectedMedia?.slug,
    mode: "manual",
    size
  });
}

function formatScopeLabel(data: KanjiClashPageData) {
  return data.selectedMedia ? data.selectedMedia.title : "Globale";
}

function buildFeedbackCopy(feedback: KanjiClashRoundFeedback) {
  const correctSubject = resolveRoundSubject(
    feedback.answeredRound,
    feedback.correctSubjectKey
  );
  const selectedSubject = resolveRoundSubject(
    feedback.answeredRound,
    feedback.selectedSubjectKey
  );
  const correctLabel = formatRevealLabel(correctSubject);
  const selectedLabel = formatRevealLabel(selectedSubject);

  if (feedback.status === "correct") {
    return {
      description: feedback.nextRound
        ? `Hai selezionato ${correctLabel}. Il prossimo round parte tra poco.`
        : `Hai selezionato ${correctLabel}. Hai chiuso la coda corrente.`,
      title: "Risposta corretta"
    };
  }

  return {
    description: `Hai selezionato ${selectedLabel}. Risposta giusta: ${correctLabel}.`,
    title: "Risposta errata"
  };
}

function resolveRoundSubject(
  round: KanjiClashSessionRound,
  subjectKey: string
): KanjiClashEligibleSubject | null {
  if (round.leftSubjectKey === subjectKey) {
    return round.left;
  }

  if (round.rightSubjectKey === subjectKey) {
    return round.right;
  }

  if (round.targetSubjectKey === subjectKey) {
    return round.target;
  }

  return null;
}

function formatRevealLabel(subject: KanjiClashEligibleSubject | null) {
  if (!subject) {
    return "Risposta non disponibile";
  }

  const surface = subject.surfaceForms[0] ?? subject.label;
  const reading = getKanjiClashSubjectReading(subject);
  const meaning = getKanjiClashSubjectMeaning(subject);

  if (reading === surface) {
    return `${surface} (${meaning})`;
  }

  return `${surface} · ${reading} (${meaning})`;
}

function buttonClassName(active: boolean) {
  return active
    ? "button button--primary button--small"
    : "button button--ghost button--small";
}
