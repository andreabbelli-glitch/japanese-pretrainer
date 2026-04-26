const SMALL_KATAKANA = new Set([
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ャ",
  "ュ",
  "ョ"
]);
const KATAKANA_MORA_MARKS = new Set(["ー", "ッ", "ン"]);

export function tokenizeKatakanaMora(input: string): string[] {
  const chars = [...input];
  const tokens: string[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (!char) {
      continue;
    }

    if (!isKatakanaMoraChar(char)) {
      continue;
    }

    if (KATAKANA_MORA_MARKS.has(char)) {
      tokens.push(char);
      continue;
    }

    const next = chars[index + 1];
    if (next && SMALL_KATAKANA.has(next)) {
      tokens.push(char + next);
      index += 1;
      continue;
    }

    tokens.push(char);
  }

  return tokens;
}

export function tokenizeKatakanaDisplaySegments(input: string): string[] {
  const moraTokens = tokenizeKatakanaMora(input);
  const segments: string[] = [];

  for (let index = 0; index < moraTokens.length; index += 1) {
    const token = moraTokens[index];

    if (!token) {
      continue;
    }

    if (token === "ー" || token === "ッ") {
      appendToLast(segments, token);
      continue;
    }

    if (
      token === "ン" &&
      segments.length > 0 &&
      index < moraTokens.length - 1
    ) {
      appendToLast(segments, token);
      continue;
    }

    segments.push(token);
  }

  return segments;
}

export function countKatakanaMora(input: string): number {
  return tokenizeKatakanaMora(input).length;
}

function isKatakanaMoraChar(char: string) {
  return (
    KATAKANA_MORA_MARKS.has(char) ||
    SMALL_KATAKANA.has(char) ||
    /^[ァ-ヴ]$/u.test(char)
  );
}

function appendToLast(tokens: string[], char: string) {
  if (tokens.length === 0) {
    tokens.push(char);
    return;
  }

  tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}${char}`;
}
