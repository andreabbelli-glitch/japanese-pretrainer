import type {
  KanjiClashEligibleSubject,
  KanjiClashPairStateStatus,
  KanjiClashSimilarKanjiSwap,
  KanjiClashRoundSource,
  KanjiClashSessionMode
} from "@/lib/kanji-clash/types";

export function formatKanjiClashModeLabel(mode: KanjiClashSessionMode) {
  return mode === "automatic" ? "FSRS" : "Drill";
}

export function formatKanjiClashRoundPosition(
  currentRoundIndex: number,
  totalCount: number
) {
  return `${currentRoundIndex + 1}/${Math.max(totalCount, 1)}`;
}

export function formatKanjiClashRoundSource(source: KanjiClashRoundSource) {
  if (source === "due") {
    return "Dovuta";
  }

  if (source === "reserve") {
    return "Riserva";
  }

  return "Nuova";
}

export function formatKanjiClashPairStateLabel(
  state: KanjiClashPairStateStatus
) {
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

export function getKanjiClashSubjectReading(
  subject: KanjiClashEligibleSubject
) {
  return subject.reading ?? subject.readingForms[0] ?? subject.label;
}

export function getKanjiClashSubjectMeaning(
  subject: KanjiClashEligibleSubject
) {
  return subject.members[0]?.meaningIt ?? "Significato non disponibile";
}

export function formatKanjiClashSimilarKanjiSwaps(
  swaps: KanjiClashSimilarKanjiSwap[]
) {
  const uniquePairs = new Set(
    swaps.map((swap) =>
      [swap.leftKanji, swap.rightKanji]
        .sort((left, right) => left.localeCompare(right))
        .join(" / ")
    )
  );

  return `Kanji simili: ${[...uniquePairs].join(", ")}`;
}
