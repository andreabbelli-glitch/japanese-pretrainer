import Link from "next/link";

import type {
  KanjiClashEligibleSubject,
  KanjiClashPageData,
  KanjiClashSessionMode,
  KanjiClashSessionRound
} from "@/lib/kanji-clash";
import { kanjiClashHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type KanjiClashPageProps = {
  data: KanjiClashPageData;
};

export function KanjiClashPage({ data }: KanjiClashPageProps) {
  return (
    <div className="kanji-clash-page">
      <StickyPageHeader
        eyebrow="Kanji Clash"
        title="Workspace di confronto"
        summary={buildHeaderSummary(data)}
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
        {data.currentRound ? (
          <KanjiClashRoundWorkspace data={data} round={data.currentRound} />
        ) : (
          <KanjiClashEmptyWorkspace data={data} />
        )}

        <KanjiClashSidebar data={data} />
      </section>
    </div>
  );
}

function KanjiClashRoundWorkspace({
  data,
  round
}: {
  data: KanjiClashPageData;
  round: KanjiClashSessionRound;
}) {
  return (
    <SurfaceCard className="kanji-clash-stage" variant="hero">
      <div className="kanji-clash-stage__top">
        <div className="kanji-clash-stage__copy">
          <p className="eyebrow">Round attuale</p>
          <h2 className="kanji-clash-stage__title">
            {formatRoundPosition(
              data.queue.currentRoundIndex,
              data.queue.totalCount
            )}
          </h2>
          <p className="kanji-clash-stage__summary">
            Il target centrale mostra lettura e significato. Le due opzioni ai
            lati restano superfici giapponesi pure da distinguere al volo.
          </p>
        </div>
        <div className="kanji-clash-stage__chips">
          <span className="chip">{formatRoundSource(round.source)}</span>
          <span className="meta-pill">{formatScopeLabel(data)}</span>
          {round.pairState ? (
            <span className="meta-pill">
              {formatPairStateLabel(round.pairState.state)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="kanji-clash-round-grid">
        <KanjiClashOptionCard
          label="Opzione sinistra"
          side="left"
          subject={round.left}
        />

        <SurfaceCard className="kanji-clash-target" variant="accent">
          <p className="eyebrow">Target</p>
          <h3 className="kanji-clash-target__reading jp-inline">
            {getSubjectReading(round.target)}
          </h3>
          <p className="kanji-clash-target__meaning">
            {getSubjectMeaning(round.target)}
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
          <p className="kanji-clash-target__note">
            Scegli quale forma giapponese corrisponde al target.
          </p>
        </SurfaceCard>

        <KanjiClashOptionCard
          label="Opzione destra"
          side="right"
          subject={round.right}
        />
      </div>
    </SurfaceCard>
  );
}

function KanjiClashOptionCard({
  label,
  side,
  subject
}: {
  label: string;
  side: "left" | "right";
  subject: KanjiClashEligibleSubject;
}) {
  return (
    <SurfaceCard
      className={`kanji-clash-option kanji-clash-option--${side}`}
      variant="quiet"
    >
      <p className="eyebrow">{label}</p>
      <h3 className="kanji-clash-option__surface jp-inline">
        {subject.surfaceForms[0] ?? subject.label}
      </h3>
      <p className="kanji-clash-option__caption">
        Forma giapponese da confrontare visivamente con il target centrale.
      </p>
    </SurfaceCard>
  );
}

function KanjiClashEmptyWorkspace({ data }: { data: KanjiClashPageData }) {
  const completedSession = data.queue.finished || data.queue.totalCount > 0;

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

function KanjiClashSidebar({ data }: { data: KanjiClashPageData }) {
  const manualSize =
    data.queue.requestedSize ?? data.settings.manualDefaultSize;

  return (
    <SurfaceCard className="kanji-clash-sidebar" variant="quiet">
      <div className="kanji-clash-sidebar__copy">
        <p className="eyebrow">Contesto</p>
        <h2 className="kanji-clash-sidebar__title">
          {formatModeLabel(data.mode)}
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
          value={String(data.queue.totalCount)}
        />
        <StatBlock
          detail="Round ancora da giocare da qui in avanti."
          label="Rimanenti"
          tone={data.queue.remainingCount > 0 ? "warning" : "default"}
          value={String(data.queue.remainingCount)}
        />
        <StatBlock
          detail={
            data.mode === "automatic"
              ? `${data.queue.introducedTodayCount}/${data.settings.dailyNewLimit} introdotte oggi.`
              : `${manualSize} round richiesti nel drill.`
          }
          label="Nuove"
          value={String(data.queue.newQueuedCount)}
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

function buildHeaderSummary(data: KanjiClashPageData) {
  const scopeLabel = formatScopeLabel(data);

  if (!data.currentRound) {
    return data.queue.finished || data.queue.totalCount > 0
      ? "La coda corrente è completa. Cambia filtro o modalità per aprire il prossimo workspace."
      : `Scope ${scopeLabel}. Nessuna coppia pronta al momento.`;
  }

  return data.mode === "automatic"
    ? `Scope ${scopeLabel}. Target centrale, due opzioni laterali e coda dedicata separata dalla review classica.`
    : `Scope ${scopeLabel}. Drill manuale con target centrale e confronto laterale già materializzati dal loader.`;
}

function buildModeHref(data: KanjiClashPageData, mode: KanjiClashSessionMode) {
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

function formatModeLabel(mode: KanjiClashSessionMode) {
  return mode === "automatic" ? "Automatico" : "Drill manuale";
}

function formatRoundPosition(currentRoundIndex: number, totalCount: number) {
  return `${currentRoundIndex + 1}/${Math.max(totalCount, 1)}`;
}

function formatRoundSource(source: KanjiClashSessionRound["source"]) {
  if (source === "due") {
    return "Dovuta";
  }

  if (source === "reserve") {
    return "Riserva";
  }

  return "Nuova";
}

function formatPairStateLabel(state: string) {
  switch (state) {
    case "review":
      return "Review";
    case "relearning":
      return "Relearning";
    case "learning":
      return "Learning";
    case "known_manual":
      return "Known manual";
    case "suspended":
      return "Sospesa";
    case "new":
    default:
      return "Nuova";
  }
}

function formatScopeLabel(data: KanjiClashPageData) {
  return data.selectedMedia ? data.selectedMedia.title : "Globale";
}

function getSubjectReading(subject: KanjiClashEligibleSubject) {
  return subject.reading ?? subject.readingForms[0] ?? subject.label;
}

function getSubjectMeaning(subject: KanjiClashEligibleSubject) {
  return subject.members[0]?.meaningIt ?? "Significato non disponibile";
}

function buttonClassName(active: boolean) {
  return active
    ? "button button--primary button--small"
    : "button button--ghost button--small";
}
