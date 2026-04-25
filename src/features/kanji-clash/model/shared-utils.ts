export const DEFAULT_KANJI_CLASH_MANUAL_SIZE = 20;

export function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number
) {
  if (!Number.isFinite(value)) {
    return Math.max(0, Math.trunc(fallback));
  }

  return Math.max(0, Math.trunc(value ?? fallback));
}

export function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
