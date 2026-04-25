import type { Route } from "next";

import { kanjiClashHref } from "@/lib/site";
import type {
  KanjiClashEligibleSubject,
  KanjiClashPageData,
  KanjiClashQueueSnapshot,
  KanjiClashSessionRound
} from "@/features/kanji-clash/types";

import { formatKanjiClashModeLabel } from "./kanji-clash-format";
import {
  getKanjiClashSubjectMeaning,
  getKanjiClashSubjectReading
} from "./kanji-clash-format";

export type KanjiClashPageIncorrectFeedbackInput = {
  answeredRound: KanjiClashSessionRound;
  correctSubjectKey: string;
  selectedSubjectKey: string;
};

export type KanjiClashPageContentInput = {
  currentRound: KanjiClashSessionRound | null;
  data: KanjiClashPageData;
  feedback: KanjiClashPageIncorrectFeedbackInput | null;
  queue: KanjiClashQueueSnapshot;
};

export type KanjiClashPageContent = {
  emptyState: KanjiClashEmptyStateContent | null;
  header: KanjiClashPageHeaderContent;
  round: KanjiClashRoundContent;
  sidebar: KanjiClashSidebarContent;
};

export type KanjiClashEmptyStateContent = {
  description: string;
  primaryAction: {
    href: Route;
    label: string;
  };
  secondaryAction: {
    href: Route;
    label: string;
  } | null;
  topUpAction: {
    href: Route;
    label: string;
  } | null;
  title: string;
};

type KanjiClashPageHeaderContent = {
  modeLinks: {
    automatic: Route;
    manual: Route;
  };
  summary: string;
};

type KanjiClashRoundContent = {
  feedbackCopy: {
    description: string;
    title: string;
  } | null;
  scopeLabel: string;
  summary: string;
};

type KanjiClashSidebarContent = {
  mediaFilters: Array<{
    active: boolean;
    href: Route;
    label: string;
  }>;
  modeLabel: string;
  note: string | null;
  sizeFilters: Array<{
    active: boolean;
    href: Route;
    label: string;
  }> | null;
  stats: {
    newDetail: string;
    queueDetail: string;
    remainingDetail: string;
    remainingTone: "default" | "warning";
    scopeDetail: string;
    scopeValue: string;
  };
  summary: string;
};

const ROUND_SUMMARY_COPY =
  "Il target centrale mostra lettura e significato. Le due opzioni ai lati restano superfici giapponesi pure da distinguere al volo.";

const AUTO_WORKSPACE_SUMMARY =
  "Prima le coppie dovute, poi nuove coppie fino al cap giornaliero di ";

const MANUAL_WORKSPACE_SUMMARY = "Sessione finita con taglia ";

const AUTO_EMPTY_STATE_DESCRIPTION =
  "Questo filtro media non produce ancora coppie eleggibili. Torna al globale oppure prova l'altra modalità.";

const GLOBAL_EMPTY_STATE_DESCRIPTION =
  "Non ci sono ancora coppie eleggibili per questo scope. Cambia modalità o restringi a un media specifico.";

const COMPLETED_SESSION_DESCRIPTION =
  "Hai chiuso la coda corrente. Puoi cambiare modalità, allargare lo scope o aprire un drill manuale su una frontiera diversa.";

const COMPLETED_MANUAL_SESSION_DESCRIPTION =
  "Hai chiuso la coda corrente. Puoi aggiungere subito altri 10 round alla frontiera attuale, cambiare modalità o allargare lo scope.";

const AUTOMATIC_NOTE =
  "Le nuove coppie restano separate dalla review standard e contano solo nel workspace Kanji Clash.";

const KANJI_CLASH_MANUAL_TOP_UP_SIZE = 10;

export function buildKanjiClashPageContent(
  input: KanjiClashPageContentInput
): KanjiClashPageContent {
  return {
    emptyState: buildEmptyStateContent(input),
    header: {
      modeLinks: {
        automatic: buildModeHref(input.data, "automatic"),
        manual: buildModeHref(input.data, "manual")
      },
      summary: buildHeaderSummary(input.data, input.queue, input.currentRound)
    },
    round: {
      feedbackCopy:
        input.feedback && input.currentRound
          ? buildIncorrectFeedbackCopy(input.feedback)
          : null,
      scopeLabel: formatScopeLabel(input.data),
      summary: ROUND_SUMMARY_COPY
    },
    sidebar: {
      mediaFilters: [
        {
          active: input.data.selectedMedia === null,
          href: buildMediaHref(input.data, null),
          label: "Globale"
        },
        ...input.data.availableMedia.map((media) => ({
          active: input.data.selectedMedia?.slug === media.slug,
          href: buildMediaHref(input.data, media.slug),
          label: media.title
        }))
      ],
      modeLabel: formatKanjiClashModeLabel(input.data.mode),
      note: input.data.mode === "automatic" ? AUTOMATIC_NOTE : null,
      sizeFilters:
        input.data.mode === "manual"
          ? buildManualSizeFilters(input.data, input.queue)
          : null,
      stats: buildSidebarStats(input.data, input.queue),
      summary: buildSidebarSummary(input.data, input.queue)
    }
  };
}

function buildEmptyStateContent(
  input: KanjiClashPageContentInput
): KanjiClashEmptyStateContent | null {
  if (input.currentRound) {
    return null;
  }

  const completedSession = input.queue.finished || input.queue.totalCount > 0;
  const primaryAction = input.data.selectedMedia
    ? {
        href: buildMediaHref(input.data, null),
        label: "Torna al globale"
      }
    : {
        href: buildModeHref(
          input.data,
          input.data.mode === "automatic" ? "manual" : "automatic"
        ),
        label: input.data.mode === "automatic" ? "Apri Drill" : "Apri FSRS"
      };
  const secondaryAction = input.data.selectedMedia
    ? {
        href: buildModeHref(
          input.data,
          input.data.mode === "automatic" ? "manual" : "automatic"
        ),
        label: "Cambia modalità"
      }
    : null;
  const topUpAction = buildTopUpAction(input.data, input.queue);

  return completedSession
    ? {
        description:
          input.data.mode === "manual" && topUpAction
            ? COMPLETED_MANUAL_SESSION_DESCRIPTION
            : COMPLETED_SESSION_DESCRIPTION,
        primaryAction:
          input.data.selectedMedia && input.data.mode === "manual"
            ? {
                href: buildMediaHref(input.data, null),
                label: "Torna al globale"
              }
            : primaryAction,
        secondaryAction,
        topUpAction,
        title: "Sessione completata"
      }
    : {
        description: input.data.selectedMedia
          ? AUTO_EMPTY_STATE_DESCRIPTION
          : GLOBAL_EMPTY_STATE_DESCRIPTION,
        primaryAction: input.data.selectedMedia
          ? {
              href: buildMediaHref(input.data, null),
              label: "Torna al globale"
            }
          : primaryAction,
        secondaryAction,
        topUpAction: null,
        title: input.data.selectedMedia
          ? `Nessun confronto pronto in ${input.data.selectedMedia.title}`
          : "Nessun confronto disponibile"
      };
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
    : `Scope ${scopeLabel}. Drill con target centrale e confronto laterale estratti da una frontiera deterministica.`;
}

function buildModeHref(
  data: KanjiClashPageData,
  mode: "automatic" | "manual"
): Route {
  return kanjiClashHref({
    media: data.selectedMedia?.slug,
    mode,
    size:
      mode === "manual"
        ? (data.queue.requestedSize ?? data.settings.manualDefaultSize)
        : undefined
  }) as Route;
}

function buildMediaHref(
  data: KanjiClashPageData,
  mediaSlug: string | null
): Route {
  return kanjiClashHref({
    media: mediaSlug ?? undefined,
    mode: data.mode,
    size:
      data.mode === "manual"
        ? (data.queue.requestedSize ?? data.settings.manualDefaultSize)
        : undefined
  }) as Route;
}

function buildSizeHref(data: KanjiClashPageData, size: number): Route {
  return kanjiClashHref({
    media: data.selectedMedia?.slug,
    mode: "manual",
    size
  }) as Route;
}

function buildManualSizeFilters(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot
) {
  const activeSize = resolveManualSize(data, queue);
  const sizeValues = data.settings.manualSizeOptions.some(
    (size) => size === activeSize
  )
    ? [...data.settings.manualSizeOptions]
    : [...data.settings.manualSizeOptions, activeSize].sort(
        (left: number, right: number) => {
          return left - right;
        }
      );

  return sizeValues.map((size: number) => ({
    active: activeSize === size,
    href: buildSizeHref(data, size),
    label: String(size)
  }));
}

function buildTopUpAction(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot
): KanjiClashEmptyStateContent["topUpAction"] {
  if (data.mode !== "manual") {
    return null;
  }

  if (queue.totalCount <= 0) {
    return null;
  }

  return {
    href: buildSizeHref(
      data,
      resolveManualSize(data, queue) + KANJI_CLASH_MANUAL_TOP_UP_SIZE
    ),
    label: "Aggiungi altri 10 round"
  };
}

function buildSidebarSummary(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot
) {
  const manualSize = resolveManualSize(data, queue);

  return data.mode === "automatic"
    ? `${AUTO_WORKSPACE_SUMMARY}${data.settings.dailyNewLimit}.`
    : `${MANUAL_WORKSPACE_SUMMARY}${manualSize}, costruita da una frontiera deterministica del pool eleggibile.`;
}

function buildSidebarStats(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot
): KanjiClashSidebarContent["stats"] {
  const manualSize = resolveManualSize(data, queue);

  return {
    newDetail:
      data.mode === "automatic"
        ? `${queue.introducedTodayCount}/${data.settings.dailyNewLimit} introdotte oggi.`
        : `${manualSize} round richiesti nella frontiera manuale.`,
    queueDetail: "Round costruiti nella sessione corrente.",
    remainingDetail: "Round ancora da giocare da qui in avanti.",
    remainingTone: queue.remainingCount > 0 ? "warning" : "default",
    scopeDetail: data.selectedMedia
      ? data.selectedMedia.title
      : "Tutto il catalogo disponibile",
    scopeValue: data.selectedMedia ? "Media" : "Globale"
  };
}

function resolveManualSize(
  data: KanjiClashPageData,
  queue: KanjiClashQueueSnapshot
) {
  return queue.requestedSize ?? data.settings.manualDefaultSize;
}

function formatScopeLabel(data: KanjiClashPageData) {
  return data.selectedMedia ? data.selectedMedia.title : "Globale";
}

function buildIncorrectFeedbackCopy(
  feedback: KanjiClashPageIncorrectFeedbackInput
) {
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
