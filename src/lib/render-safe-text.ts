const RAW_MARKDOWN_PATTERNS = [
  /!\[[^\]]*\]\([^)]+\)/u,
  /\[[^\]]+\]\([^)]+\)/u,
  /(^|[\s(])(?:\*\*|__|\*|_|~~|`)[^*_~`]+(?:\*\*|__|\*|_|~~|`)(?=$|[\s).,!?:;])/u,
  /(^|\n)\s{0,3}(?:[#>-]|\d+\.)\s+/u,
  /<\/?[a-z][^>]*>/iu,
  /(?:^|[\s[(])(term|grammar):[a-z0-9-]+(?:$|[\s)\]])/iu
] as const;

export function getRenderSafeText(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return RAW_MARKDOWN_PATTERNS.some((pattern) => pattern.test(trimmed))
    ? undefined
    : trimmed;
}
