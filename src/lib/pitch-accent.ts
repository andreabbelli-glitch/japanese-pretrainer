export type PitchLevel = "high" | "low";

export type PitchAccentShape =
  | "heiban"
  | "atamadaka"
  | "nakadaka"
  | "odaka";

export type PitchAccentData = {
  downstep: number;
  levels: PitchLevel[];
  morae: string[];
  shape: PitchAccentShape;
  trailingLevel: PitchLevel;
};

const combinableSmallKana = new Set([
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゃ",
  "ゅ",
  "ょ",
  "ゎ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ャ",
  "ュ",
  "ョ",
  "ヮ",
  "ヵ",
  "ヶ"
]);

export function buildPitchAccentData(
  reading: string | null | undefined,
  downstep: number | null | undefined
): PitchAccentData | null {
  if (typeof reading !== "string" || typeof downstep !== "number") {
    return null;
  }

  const morae = splitJapaneseMorae(reading);

  if (
    morae.length === 0 ||
    !Number.isInteger(downstep) ||
    downstep < 0 ||
    downstep > morae.length
  ) {
    return null;
  }

  const levels = morae.map((_, index) => resolvePitchLevel(index, downstep));

  return {
    downstep,
    levels,
    morae,
    shape: resolvePitchAccentShape(downstep, morae.length),
    trailingLevel: downstep === 0 ? "high" : "low"
  };
}

export function splitJapaneseMorae(reading: string): string[] {
  const normalized = reading.replace(/[\s～〜・･]+/gu, "");
  const morae: string[] = [];

  for (const char of normalized) {
    if (
      combinableSmallKana.has(char) &&
      morae.length > 0 &&
      canCombineWithPreviousMora(morae[morae.length - 1] ?? "")
    ) {
      morae[morae.length - 1] = `${morae[morae.length - 1]}${char}`;
      continue;
    }

    morae.push(char);
  }

  return morae;
}

export function formatPitchAccentLabel(data: PitchAccentData): string {
  return `${pitchAccentShapeLabels[data.shape]} (${data.downstep})`;
}

export const pitchAccentShapeLabels: Record<PitchAccentShape, string> = {
  atamadaka: "Atamadaka",
  heiban: "Heiban",
  nakadaka: "Nakadaka",
  odaka: "Odaka"
};

function canCombineWithPreviousMora(previousMora: string) {
  if (previousMora.length === 0) {
    return false;
  }

  const previousChar = previousMora.at(-1);

  return previousChar !== undefined && previousChar !== "っ" && previousChar !== "ッ";
}

function resolvePitchAccentShape(
  downstep: number,
  moraCount: number
): PitchAccentShape {
  if (downstep === 0) {
    return "heiban";
  }

  if (downstep === 1) {
    return "atamadaka";
  }

  if (downstep === moraCount) {
    return "odaka";
  }

  return "nakadaka";
}

function resolvePitchLevel(index: number, downstep: number): PitchLevel {
  if (downstep === 1) {
    return index === 0 ? "high" : "low";
  }

  if (downstep === 0) {
    return index === 0 ? "low" : "high";
  }

  if (index === 0) {
    return "low";
  }

  return index < downstep ? "high" : "low";
}
