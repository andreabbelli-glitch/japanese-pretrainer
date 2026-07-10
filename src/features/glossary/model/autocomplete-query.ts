import {
  compactLatinSearchText,
  normalizeSearchText
} from "@/features/study/model/search";

const JAPANESE_BASE_CHARACTER_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const JAPANESE_SCRIPT_EXTENSION_PATTERN =
  /[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u;
const MIN_NON_JAPANESE_QUERY_LENGTH = 3;

export function isGlossaryAutocompleteQueryEligible(rawQuery: string) {
  const query = normalizeSearchText(rawQuery);

  if (query.length === 0) {
    return false;
  }

  const japaneseCharacters = [...query].filter((character) =>
    JAPANESE_SCRIPT_EXTENSION_PATTERN.test(character)
  );

  if (
    japaneseCharacters.some((character) =>
      JAPANESE_BASE_CHARACTER_PATTERN.test(character)
    )
  ) {
    return true;
  }

  return compactLatinSearchText(query).length >= MIN_NON_JAPANESE_QUERY_LENGTH;
}
