import { formatLocalIsoDate } from "./local-date";
import type { ReviewQueueCard } from "./review-types";

export function buildBucketDetail(
  bucket: ReviewQueueCard["bucket"],
  dueAt: string | null
) {
  if (bucket === "due") {
    return dueAt
      ? `Richiede attenzione oggi. Scadenza ${formatShortIsoDate(dueAt)}.`
      : "Richiede attenzione oggi.";
  }

  if (bucket === "new") {
    return "Pronta per entrare nella coda giornaliera senza perdere il legame con il Glossary.";
  }

  if (bucket === "manual") {
    return "Una voce collegata è stata impostata manualmente come già nota.";
  }

  if (bucket === "suspended") {
    return "La card è stata messa in pausa e non entra nella sessione finché non la riattivi.";
  }

  return dueAt
    ? `Resta in rotazione. Prossima scadenza ${formatShortIsoDate(dueAt)}.`
    : "Resta in rotazione ma oggi non richiede un passaggio.";
}

export function formatBucketLabel(bucket: ReviewQueueCard["bucket"]) {
  if (bucket === "due") {
    return "Dovuta";
  }

  if (bucket === "new") {
    return "Nuova";
  }

  if (bucket === "suspended") {
    return "Sospesa";
  }

  if (bucket === "upcoming") {
    return "Da ripassare nei prossimi giorni";
  }

  return "Già nota";
}

export function formatShortIsoDate(value: string) {
  return formatLocalIsoDate(value);
}
