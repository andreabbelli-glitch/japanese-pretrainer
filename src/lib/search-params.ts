export function hasSearchParamValue(
  value: string | string[] | undefined,
  expected: string
) {
  const candidates = Array.isArray(value) ? value : [value];

  return candidates.some((candidate) => candidate?.trim() === expected);
}
