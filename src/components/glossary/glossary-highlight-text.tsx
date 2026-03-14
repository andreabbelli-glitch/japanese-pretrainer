import type { GlossaryMatchMode } from "@/lib/glossary";
import {
  compactLatinSearchText,
  foldJapaneseKana,
  normalizeGrammarSearchText,
  normalizeSearchText
} from "@/lib/study-search";

type HighlightTextProps = {
  mode?: GlossaryMatchMode;
  query: string;
  text: string;
};

export function HighlightText({
  mode,
  query,
  text
}: HighlightTextProps) {
  if (!mode || !query) {
    return text;
  }

  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return text;
  }

  const parts = splitLiteralMatch(text, trimmedQuery);

  if (parts) {
    return parts;
  }

  const normalizedText = normalizeForMatchMode(text, mode);
  const normalizedQuery = normalizeForMatchMode(trimmedQuery, mode);

  if (
    !normalizedText ||
    !normalizedQuery ||
    !normalizedText.includes(normalizedQuery)
  ) {
    return text;
  }

  return <mark>{text}</mark>;
}

function splitLiteralMatch(text: string, query: string) {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(matcher);

  if (parts.length === 1) {
    return null;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function normalizeForMatchMode(value: string, mode: GlossaryMatchMode) {
  switch (mode) {
    case "kana":
      return foldJapaneseKana(normalizeSearchText(value));
    case "grammarKana":
      return foldJapaneseKana(normalizeGrammarSearchText(value));
    case "romajiCompact":
      return compactLatinSearchText(value);
    case "normalized":
      return normalizeSearchText(value);
  }
}
