export function calculatePercent(value: number, total: number) {
  if (total <= 0) {
    return null;
  }

  return Math.round((value / total) * 100);
}

export function compareIsoDates(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return -1;
  }

  if (right === null) {
    return 1;
  }

  return left.localeCompare(right);
}

export function formatMediaTypeLabel(value: string) {
  const labels: Record<string, string> = {
    anime: "Anime",
    manga: "Manga",
    novel: "Novel",
    visual_novel: "Visual novel",
    videogame: "Videogioco",
    tcg: "TCG",
    movie: "Film",
    drama: "Drama",
    custom: "Custom"
  };

  return labels[value] ?? capitalizeToken(value);
}

export function formatSegmentKindLabel(value: string) {
  const labels: Record<string, string> = {
    episode: "episodi",
    chapter: "capitoli",
    area: "aree",
    route: "route",
    deck: "deck",
    arc: "archi",
    segment: "segmenti"
  };

  return labels[value] ?? capitalizeToken(value);
}

export function formatStatusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Attivo",
    archived: "Archiviato",
    draft: "Bozza",
    paused: "In pausa"
  };

  return labels[value] ?? capitalizeToken(value);
}

export function formatLessonProgressStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    not_started: "Da iniziare",
    in_progress: "In corso",
    completed: "Completata"
  };

  if (!value) {
    return "Da iniziare";
  }

  return labels[value] ?? capitalizeToken(value);
}

export function formatReviewStateLabel(
  value: string | null,
  manualOverride = false
) {
  if (manualOverride || value === "known_manual") {
    return "Già nota";
  }

  if (!value) {
    return "Non schedulata";
  }

  const labels: Record<string, string> = {
    new: "Nuova",
    learning: "In apprendimento",
    review: "In review",
    relearning: "Da riprendere",
    suspended: "Sospesa"
  };

  return labels[value] ?? capitalizeToken(value);
}

export function formatCardRelationshipLabel(value: string) {
  const labels: Record<string, string> = {
    primary: "Card principale",
    secondary: "Card secondaria",
    context: "Card di contesto"
  };

  return labels[value] ?? capitalizeToken(value);
}

export function capitalizeToken(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]!.toUpperCase() + chunk.slice(1))
    .join(" ");
}
