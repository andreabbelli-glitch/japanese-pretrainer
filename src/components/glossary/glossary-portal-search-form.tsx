"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState
} from "react";

import type {
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData
} from "@/lib/glossary";

type GlossaryPortalSearchFormProps = {
  filters: GlobalGlossaryPageData["filters"];
  hasActiveFilters: boolean;
  mediaOptions: GlobalGlossaryPageData["mediaOptions"];
};

const AUTOCOMPLETE_DEBOUNCE_MS = 140;

function buildAutocompleteKey(input: {
  cards: string;
  entryType: string;
  media: string;
  query: string;
  study: string;
}) {
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

export function GlossaryPortalSearchForm({
  filters,
  hasActiveFilters,
  mediaOptions
}: GlossaryPortalSearchFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionCacheRef = useRef(
    new Map<string, GlobalGlossaryAutocompleteSuggestion[]>()
  );
  const listboxId = useId();
  const [query, setQuery] = useState(filters.query);
  const [entryType, setEntryType] = useState(filters.entryType);
  const [media, setMedia] = useState(filters.media);
  const [study, setStudy] = useState(filters.study);
  const [cards, setCards] = useState(filters.cards);
  const [suggestions, setSuggestions] = useState<
    GlobalGlossaryAutocompleteSuggestion[]
  >([]);
  const [suggestionsKey, setSuggestionsKey] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    if (trimmedQuery.length === 0) {
      startTransition(() => {
        setSuggestions([]);
        setSuggestionsKey("");
      });
      return;
    }

    const cacheKey = buildAutocompleteKey({
      cards,
      entryType,
      media,
      query: trimmedQuery,
      study
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
  }, [cards, debouncedQuery, entryType, media, study]);

  const autocompleteKey = buildAutocompleteKey({
    cards,
    entryType,
    media,
    query,
    study
  });
  const shouldShowSuggestions =
    showSuggestions &&
    query.trim().length > 0 &&
    suggestions.length > 0 &&
    suggestionsKey === autocompleteKey;

  const handleSuggestionSelect = (
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) => {
    setQuery(suggestion.label);
    setShowSuggestions(false);
    inputRef.current?.blur();
    if (inputRef.current) {
      inputRef.current.value = suggestion.label;
    }

    requestAnimationFrame(() => {
      formRef.current?.requestSubmit();
    });
  };

  return (
    <Form
      ref={formRef}
      action="/glossary"
      className="glossary-search-form glossary-search-form--portal"
    >
      {filters.sort !== "lesson_order" ? (
        <input name="sort" type="hidden" value={filters.sort} />
      ) : null}

      <div className="glossary-portal-search__query-row">
        <label className="glossary-search-form__field glossary-portal-search__query-field">
          <span className="glossary-search-form__label">Cerca</span>
          <div className="glossary-autocomplete">
            <input
              ref={inputRef}
              aria-autocomplete="list"
              aria-controls={shouldShowSuggestions ? listboxId : undefined}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="glossary-search-form__input"
              enterKeyHint="search"
              inputMode="search"
              name="q"
              onBlur={() => {
                setShowSuggestions(false);
              }}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setShowSuggestions(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowSuggestions(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder="食べる, たべる, taberu, mangiare"
              spellCheck={false}
              type="search"
              value={query}
            />

            {shouldShowSuggestions ? (
              <div
                className="glossary-autocomplete__panel"
                id={listboxId}
                role="listbox"
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.resultKey}
                    className="glossary-autocomplete__option"
                    onClick={() => {
                      handleSuggestionSelect(suggestion);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                    }}
                    aria-selected={false}
                    role="option"
                    type="button"
                  >
                    <span className="glossary-autocomplete__option-top">
                      <span className="glossary-autocomplete__option-label jp-inline">
                        {suggestion.label}
                      </span>
                      <span className="glossary-autocomplete__option-meta">
                        {suggestion.kind === "term" ? "Termine" : "Grammatica"}
                        {suggestion.mediaCount > 1
                          ? ` · ${suggestion.mediaCount} media`
                          : ""}
                        {!suggestion.hasCards ? " · senza flashcard" : ""}
                      </span>
                    </span>
                    {(suggestion.reading || suggestion.romaji) ? (
                      <span className="glossary-autocomplete__option-reading jp-inline">
                        {suggestion.reading ?? ""}
                        {suggestion.reading && suggestion.romaji ? " / " : ""}
                        {suggestion.romaji ?? ""}
                      </span>
                    ) : null}
                    <span className="glossary-autocomplete__option-meaning">
                      {suggestion.title && suggestion.title !== suggestion.label
                        ? `${suggestion.title} · `
                        : ""}
                      {suggestion.meaning}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>

        <div className="glossary-search-form__actions glossary-search-form__actions--portal">
          <button className="button button--primary" type="submit">
            Cerca
          </button>
          {hasActiveFilters ? (
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                router.replace("/glossary");
              }}
            >
              Azzera i filtri
            </button>
          ) : null}
        </div>
      </div>

      <div className="glossary-search-form__filters">
        <label className="glossary-search-form__field">
          <span className="glossary-search-form__label">Tipo</span>
          <select
            className="glossary-search-form__select"
            name="type"
            onChange={(event) => {
              setEntryType(event.currentTarget.value as typeof entryType);
            }}
            value={entryType}
          >
            <option value="all">Tutto</option>
            <option value="term">Termine</option>
            <option value="grammar">Grammatica</option>
          </select>
        </label>

        <label className="glossary-search-form__field">
          <span className="glossary-search-form__label">Media</span>
          <select
            className="glossary-search-form__select"
            name="media"
            onChange={(event) => {
              setMedia(event.currentTarget.value);
            }}
            value={media}
          >
            <option value="all">Tutti i media</option>
            {mediaOptions.map((mediaOption) => (
              <option key={mediaOption.id} value={mediaOption.slug}>
                {mediaOption.title}
              </option>
            ))}
          </select>
        </label>

        <label className="glossary-search-form__field">
          <span className="glossary-search-form__label">Stato</span>
          <select
            className="glossary-search-form__select"
            name="study"
            onChange={(event) => {
              setStudy(event.currentTarget.value as typeof study);
            }}
            value={study}
          >
            <option value="all">Tutti</option>
            <option value="known">Già note</option>
            <option value="review">In Review</option>
            <option value="learning">In studio</option>
            <option value="new">Nuove</option>
            <option value="available">Disponibili</option>
          </select>
        </label>

        <label className="glossary-search-form__field">
          <span className="glossary-search-form__label">Flashcard</span>
          <select
            className="glossary-search-form__select"
            name="cards"
            onChange={(event) => {
              setCards(event.currentTarget.value as typeof cards);
            }}
            value={cards}
          >
            <option value="all">Tutte</option>
            <option value="with_cards">Ha flashcard</option>
            <option value="without_cards">Senza flashcard</option>
          </select>
        </label>
      </div>
    </Form>
  );
}
