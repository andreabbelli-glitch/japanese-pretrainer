"use client";

import { useDeferredValue, useId, useRef, useState } from "react";
import Link from "next/link";

import type {
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData
} from "@/lib/glossary";
import { getGlossaryAutocompleteSuggestions } from "@/lib/glossary-autocomplete";

type GlossaryPortalSearchFormProps = {
  filters: GlobalGlossaryPageData["filters"];
  hasActiveFilters: boolean;
  mediaOptions: GlobalGlossaryPageData["mediaOptions"];
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
};

export function GlossaryPortalSearchForm({
  filters,
  hasActiveFilters,
  mediaOptions,
  suggestions
}: GlossaryPortalSearchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState(filters.query);
  const [entryType, setEntryType] = useState(filters.entryType);
  const [media, setMedia] = useState(filters.media);
  const [study, setStudy] = useState(filters.study);
  const [cards, setCards] = useState(filters.cards);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const visibleSuggestions = getGlossaryAutocompleteSuggestions({
    filters: {
      cards,
      entryType,
      media,
      study
    },
    query: deferredQuery,
    suggestions
  });
  const shouldShowSuggestions =
    showSuggestions &&
    deferredQuery.trim().length > 0 &&
    visibleSuggestions.length > 0;

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
    <form
      ref={formRef}
      className="glossary-search-form glossary-search-form--portal"
      method="get"
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
              aria-expanded={shouldShowSuggestions}
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
                {visibleSuggestions.map((suggestion) => (
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
            <Link className="button button--ghost" href="/glossary">
              Azzera i filtri
            </Link>
          ) : null}
        </div>
      </div>

      <div className="glossary-search-form__filters">
        <label className="glossary-search-form__field">
          <span className="glossary-search-form__label">Tipo</span>
          <select
            className="glossary-search-form__select"
            defaultValue={filters.entryType}
            name="type"
            onChange={(event) => {
              setEntryType(event.currentTarget.value as typeof entryType);
            }}
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
            defaultValue={filters.media}
            name="media"
            onChange={(event) => {
              setMedia(event.currentTarget.value);
            }}
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
            defaultValue={filters.study}
            name="study"
            onChange={(event) => {
              setStudy(event.currentTarget.value as typeof study);
            }}
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
            defaultValue={filters.cards}
            name="cards"
            onChange={(event) => {
              setCards(event.currentTarget.value as typeof cards);
            }}
          >
            <option value="all">Tutte</option>
            <option value="with_cards">Ha flashcard</option>
            <option value="without_cards">Senza flashcard</option>
          </select>
        </label>
      </div>
    </form>
  );
}
