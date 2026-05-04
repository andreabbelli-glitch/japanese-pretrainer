export type SearchParamValue = string | string[] | undefined;

export function hasSearchParamValue(
  value: SearchParamValue,
  expected: string
) {
  const candidates = Array.isArray(value) ? value : [value];

  return candidates.some((candidate) => candidate?.trim() === expected);
}

export function readFirstNonEmptySearchParam(value: SearchParamValue) {
  return readMatchingSearchParam(value, () => true);
}

export function readMatchingSearchParam<T extends string>(
  value: SearchParamValue,
  matcher: (value: string) => value is T
): T | undefined;
export function readMatchingSearchParam(
  value: SearchParamValue,
  matcher: (value: string) => boolean
): string | undefined;
export function readMatchingSearchParam(
  value: SearchParamValue,
  matcher: (value: string) => boolean
) {
  const candidates = Array.isArray(value) ? value : [value];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    if (matcher(trimmed)) {
      return trimmed;
    }
  }

  return undefined;
}
