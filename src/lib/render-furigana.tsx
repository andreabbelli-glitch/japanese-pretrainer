// Combined regex: {{base|reading}}, `code`, [label](term:id) / [label](grammar:id)
const INLINE_PATTERN =
  /\{\{([^|]+)\|([^}]+)\}\}|`([^`]+)`|\[([^\]]+)\]\((?:term|grammar):[^\)]+\)/gu;

export function renderFurigana(text: string) {
  const result = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Reset lastIndex before exec loop (regex is reused across calls)
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      // {{base|reading}} → <ruby>
      result.push(
        <ruby key={match.index}>
          {match[1]}
          <rt>{match[2]}</rt>
        </ruby>
      );
    } else if (match[3] !== undefined) {
      // `code` → <code>
      result.push(
        <code key={match.index} className="jp-inline">
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined) {
      // [label](term:id) or [label](grammar:id) → styled label
      result.push(
        <strong key={match.index} className="inline-ref">
          {match[4]}
        </strong>
      );
    }
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result;
}

/** Strips inline markdown syntax, returning plain text suitable for search normalization. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\{\{([^|]+)\|[^}]+\}\}/gu, "$1") // {{base|reading}} → base
    .replace(/`([^`]+)`/gu, "$1") // `text` → text
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1"); // [label](ref) → label
}
