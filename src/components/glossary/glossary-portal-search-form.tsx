"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { GlobalGlossaryPageData } from "@/features/glossary/types";

import {
  getNextGlossaryAutocompleteIndex,
  GlossaryAutocompleteDropdown
} from "@/features/glossary/ui/client/glossary-autocomplete-dropdown";
import { useGlossaryAutocomplete } from "@/features/glossary/ui/client/use-glossary-autocomplete";

type GlossaryPortalSearchFormProps = {
  filters: GlobalGlossaryPageData["filters"];
  hasActiveFilters: boolean;
  mediaOptions: GlobalGlossaryPageData["mediaOptions"];
};

export function GlossaryPortalSearchForm({
  filters,
  hasActiveFilters,
  mediaOptions
}: GlossaryPortalSearchFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(filters.query);
  const [entryType, setEntryType] = useState(filters.entryType);
  const [media, setMedia] = useState(filters.media);
  const [study, setStudy] = useState(filters.study);
  const [cards, setCards] = useState(filters.cards);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const initialAdvancedFilterCount = [
    filters.entryType !== "all",
    filters.media !== "all",
    filters.study !== "all",
    filters.cards !== "all"
  ].filter(Boolean).length;
  const [areFiltersOpen, setAreFiltersOpen] = useState(
    initialAdvancedFilterCount > 0
  );
  const { listboxId, shouldShowSuggestions, suggestions } =
    useGlossaryAutocomplete({
      filters: {
        cards,
        entryType,
        media,
        study
      },
      isOpen: showSuggestions,
      query
    });
  const advancedFilterCount = [
    entryType !== "all",
    media !== "all",
    study !== "all",
    cards !== "all"
  ].filter(Boolean).length;
  const resolvedActiveSuggestionIndex =
    shouldShowSuggestions && activeSuggestionIndex < suggestions.length
      ? activeSuggestionIndex
      : -1;
  const activeDescendant =
    resolvedActiveSuggestionIndex >= 0
      ? `${listboxId}-option-${resolvedActiveSuggestionIndex}`
      : undefined;

  const handleSuggestionSelect = (suggestion: (typeof suggestions)[number]) => {
    setQuery(suggestion.label);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.blur();
    if (inputRef.current) {
      inputRef.current.value = suggestion.label;
    }

    const params = new URLSearchParams();

    params.set("q", suggestion.label);
    params.set("type", entryType);
    params.set("media", media);
    params.set("study", study);
    params.set("cards", cards);

    if (filters.sort !== "lesson_order") {
      params.set("sort", filters.sort);
    }

    router.replace(`/glossary?${params.toString()}`);
  };

  return (
    <Form
      action="/glossary"
      className="glossary-search-form glossary-search-form--portal"
    >
      {filters.sort !== "lesson_order" ? (
        <input name="sort" type="hidden" value={filters.sort} />
      ) : null}

      <div className="glossary-portal-search__query-row">
        <div className="glossary-search-form__field glossary-portal-search__query-field">
          <label
            className="glossary-search-form__label"
            htmlFor="glossary-portal-query"
          >
            Cerca
          </label>
          <div className="glossary-autocomplete">
            <input
              ref={inputRef}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              aria-controls={shouldShowSuggestions ? listboxId : undefined}
              aria-expanded={shouldShowSuggestions}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="glossary-search-form__input"
              enterKeyHint="search"
              id="glossary-portal-query"
              inputMode="search"
              name="q"
              onBlur={() => {
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
              }}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setShowSuggestions(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => {
                setShowSuggestions(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  if (!shouldShowSuggestions) {
                    return;
                  }

                  event.preventDefault();
                  setActiveSuggestionIndex((currentIndex) =>
                    getNextGlossaryAutocompleteIndex({
                      currentIndex,
                      direction:
                        event.key === "ArrowDown" ? "next" : "previous",
                      suggestionCount: suggestions.length
                    })
                  );
                  return;
                }

                if (
                  event.key === "Enter" &&
                  resolvedActiveSuggestionIndex >= 0
                ) {
                  const activeSuggestion =
                    suggestions[resolvedActiveSuggestionIndex];

                  if (activeSuggestion) {
                    event.preventDefault();
                    handleSuggestionSelect(activeSuggestion);
                  }
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setShowSuggestions(false);
                  setActiveSuggestionIndex(-1);
                }
              }}
              placeholder="食べる, たべる, taberu, mangiare"
              spellCheck={false}
              type="search"
              value={query}
              role="combobox"
            />

            <GlossaryAutocompleteDropdown
              activeIndex={resolvedActiveSuggestionIndex}
              listboxId={listboxId}
              onActiveIndexChange={setActiveSuggestionIndex}
              onSelect={handleSuggestionSelect}
              shouldShowSuggestions={shouldShowSuggestions}
              suggestions={suggestions}
            />
          </div>
        </div>

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

      <details
        className="glossary-search-form__filter-disclosure"
        onToggle={(event) => {
          setAreFiltersOpen(event.currentTarget.open);
        }}
        open={areFiltersOpen}
      >
        <summary className="glossary-search-form__filter-summary">
          <span>Filtri</span>
          <small>
            {advancedFilterCount > 0
              ? `${advancedFilterCount} attivi`
              : "Tipo, media, stato e flashcard"}
          </small>
        </summary>

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
      </details>
    </Form>
  );
}
