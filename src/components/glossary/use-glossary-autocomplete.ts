"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";

import type {
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData
} from "@/lib/glossary";

type GlossaryAutocompleteFilters = Pick<
  GlobalGlossaryPageData["filters"],
  "cards" | "entryType" | "media" | "study"
>;

type GlossaryAutocompleteKeyInput = {
  cards: string;
  entryType: string;
  media: string;
  query: string;
  study: string;
};

type UseGlossaryAutocompleteInput = {
  filters: GlossaryAutocompleteFilters;
  isOpen: boolean;
  query: string;
};

export type UseGlossaryAutocompleteResult = {
  listboxId: string;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
  suggestionsKey: string;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 140;

export function useGlossaryAutocomplete({
  filters,
  isOpen,
  query
}: UseGlossaryAutocompleteInput): UseGlossaryAutocompleteResult {
  const listboxId = useId();
  const suggestionCacheRef = useRef(
    new Map<string, GlobalGlossaryAutocompleteSuggestion[]>()
  );
  const [suggestions, setSuggestions] = useState<
    GlobalGlossaryAutocompleteSuggestion[]
  >([]);
  const [suggestionsKey, setSuggestionsKey] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const normalizedQuery = query.trim();
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery;

    if (!isOpen || trimmedQuery.length === 0) {
      startTransition(() => {
        setSuggestions([]);
        setSuggestionsKey("");
      });
      return;
    }

    const cacheKey = buildAutocompleteKey({
      cards: filters.cards,
      entryType: filters.entryType,
      media: filters.media,
      query: trimmedQuery,
      study: filters.study
    });
    const cachedSuggestions = suggestionCacheRef.current.get(cacheKey);

    if (cachedSuggestions) {
      startTransition(() => {
        setSuggestions(cachedSuggestions);
        setSuggestionsKey(cacheKey);
      });
      return;
    }

    const controller = new AbortController();

    fetch(`/api/glossary/autocomplete?${cacheKey}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Autocomplete request failed: ${response.status}`);
        }

        const payload =
          (await response.json()) as GlobalGlossaryAutocompleteSuggestion[];

        suggestionCacheRef.current.set(cacheKey, payload);
        startTransition(() => {
          setSuggestions(payload);
          setSuggestionsKey(cacheKey);
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setSuggestions([]);
          setSuggestionsKey("");
        });
      });

    return () => {
      controller.abort();
    };
  }, [
    debouncedQuery,
    filters.cards,
    filters.entryType,
    filters.media,
    filters.study,
    isOpen
  ]);

  const autocompleteKey = buildAutocompleteKey({
    cards: filters.cards,
    entryType: filters.entryType,
    media: filters.media,
    query,
    study: filters.study
  });
  const shouldShowSuggestions =
    isOpen &&
    query.trim().length > 0 &&
    suggestions.length > 0 &&
    suggestionsKey === autocompleteKey;

  return {
    listboxId,
    shouldShowSuggestions,
    suggestions,
    suggestionsKey
  };
}

function buildAutocompleteKey(input: GlossaryAutocompleteKeyInput) {
  const params = new URLSearchParams({
    q: input.query.trim()
  });

  if (input.entryType !== "all") {
    params.set("type", input.entryType);
  }

  if (input.media !== "all") {
    params.set("media", input.media);
  }

  if (input.study !== "all") {
    params.set("study", input.study);
  }

  if (input.cards !== "all") {
    params.set("cards", input.cards);
  }

  return params.toString();
}
