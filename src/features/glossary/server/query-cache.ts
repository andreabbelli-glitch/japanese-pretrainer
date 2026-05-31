import { buildFilteredQuery } from "@/features/glossary/model/search";

export function buildGlossaryQueryCacheKeyParts(query: string) {
  const filteredQuery = buildFilteredQuery(query);

  return [
    `query:${filteredQuery?.normalized ?? ""}`,
    `kana:${filteredQuery?.kana ?? ""}`,
    `grammar-kana:${filteredQuery?.grammarKana ?? ""}`,
    `compact:${filteredQuery?.compact ?? ""}`
  ];
}
