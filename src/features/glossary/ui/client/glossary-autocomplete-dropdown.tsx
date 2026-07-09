"use client";

import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

type GlossaryAutocompleteDropdownProps = {
  activeIndex?: number;
  listboxId: string;
  onActiveIndexChange?: (index: number) => void;
  onSelect: (suggestion: GlobalGlossaryAutocompleteSuggestion) => void;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
};

export function getNextGlossaryAutocompleteIndex(input: {
  currentIndex: number;
  direction: "next" | "previous";
  suggestionCount: number;
}) {
  if (input.suggestionCount <= 0) {
    return -1;
  }

  if (input.direction === "next") {
    return input.currentIndex >= input.suggestionCount - 1
      ? 0
      : input.currentIndex + 1;
  }

  return input.currentIndex <= 0
    ? input.suggestionCount - 1
    : input.currentIndex - 1;
}

export function GlossaryAutocompleteDropdown({
  activeIndex = -1,
  listboxId,
  onActiveIndexChange,
  onSelect,
  shouldShowSuggestions,
  suggestions
}: GlossaryAutocompleteDropdownProps) {
  if (!shouldShowSuggestions) {
    return null;
  }

  return (
    <div className="glossary-autocomplete__panel" id={listboxId} role="listbox">
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.resultKey}
          id={`${listboxId}-option-${index}`}
          className="glossary-autocomplete__option"
          onClick={() => {
            onSelect(suggestion);
          }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onMouseEnter={() => {
            onActiveIndexChange?.(index);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
          }}
          aria-selected={activeIndex === index}
          role="option"
          tabIndex={-1}
          type="button"
        >
          <span className="glossary-autocomplete__option-top">
            <span
              className="glossary-autocomplete__option-label jp-inline"
              lang="ja"
            >
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
          {suggestion.reading || suggestion.romaji ? (
            <span className="glossary-autocomplete__option-reading jp-inline">
              {suggestion.reading ? (
                <span lang="ja">{suggestion.reading}</span>
              ) : null}
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
  );
}
