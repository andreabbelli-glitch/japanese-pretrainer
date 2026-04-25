"use client";

import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

type GlossaryAutocompleteDropdownProps = {
  listboxId: string;
  onSelect: (suggestion: GlobalGlossaryAutocompleteSuggestion) => void;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
};

export function GlossaryAutocompleteDropdown({
  listboxId,
  onSelect,
  shouldShowSuggestions,
  suggestions
}: GlossaryAutocompleteDropdownProps) {
  if (!shouldShowSuggestions) {
    return null;
  }

  return (
    <div className="glossary-autocomplete__panel" id={listboxId} role="listbox">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.resultKey}
          className="glossary-autocomplete__option"
          onClick={() => {
            onSelect(suggestion);
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
              {suggestion.mediaCount > 1 ? ` · ${suggestion.mediaCount} media` : ""}
              {!suggestion.hasCards ? " · senza flashcard" : ""}
            </span>
          </span>
          {suggestion.reading || suggestion.romaji ? (
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
  );
}
