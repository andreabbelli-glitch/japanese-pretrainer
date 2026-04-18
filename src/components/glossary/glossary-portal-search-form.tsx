"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { GlobalGlossaryPageData } from "@/lib/glossary";

import { GlossaryAutocompleteDropdown } from "./glossary-autocomplete-dropdown";
import { useGlossaryAutocomplete } from "./use-glossary-autocomplete";

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
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(filters.query);
  const [entryType, setEntryType] = useState(filters.entryType);
  const [media, setMedia] = useState(filters.media);
  const [study, setStudy] = useState(filters.study);
  const [cards, setCards] = useState(filters.cards);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const {
    listboxId,
    shouldShowSuggestions,
    suggestions
  } = useGlossaryAutocomplete({
    filters: {
      cards,
      entryType,
      media,
      study
    },
    isOpen: showSuggestions,
    query
  });

  const handleSuggestionSelect = (
    suggestion: (typeof suggestions)[number]
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

            <GlossaryAutocompleteDropdown
              listboxId={listboxId}
              onSelect={handleSuggestionSelect}
              shouldShowSuggestions={shouldShowSuggestions}
              suggestions={suggestions}
            />
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
