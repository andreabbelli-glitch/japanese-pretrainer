import { useState, type RefObject } from "react";

import {
  getNextGlossaryAutocompleteIndex,
  GlossaryAutocompleteDropdown
} from "@/features/glossary/ui/client/glossary-autocomplete-dropdown";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

export function ReviewForcedContrastAutocomplete({
  inputRef,
  listboxId,
  onClose,
  onQueryChange,
  onSelect,
  query,
  shouldShowSuggestions,
  suggestions
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listboxId: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (suggestion: GlobalGlossaryAutocompleteSuggestion) => void;
  query: string;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const resolvedActiveIndex =
    shouldShowSuggestions &&
    activeIndex >= 0 &&
    activeIndex < suggestions.length
      ? activeIndex
      : -1;
  const activeDescendant =
    resolvedActiveIndex >= 0
      ? `${listboxId}-option-${resolvedActiveIndex}`
      : undefined;

  const close = () => {
    setActiveIndex(-1);
    onClose();
  };

  const select = (suggestion: GlobalGlossaryAutocompleteSuggestion) => {
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  return (
    <div className="glossary-autocomplete">
      <label className="sr-only" htmlFor="review-forced-contrast-query">
        Cerca una card di contrasto
      </label>
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
        id="review-forced-contrast-query"
        inputMode="search"
        onBlur={close}
        onChange={(event) => {
          setActiveIndex(-1);
          onQueryChange(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!shouldShowSuggestions) {
              return;
            }

            event.preventDefault();
            setActiveIndex((currentIndex) =>
              getNextGlossaryAutocompleteIndex({
                currentIndex,
                direction: event.key === "ArrowDown" ? "next" : "previous",
                suggestionCount: suggestions.length
              })
            );
            return;
          }

          if (event.key === "Enter" && resolvedActiveIndex >= 0) {
            const activeSuggestion = suggestions[resolvedActiveIndex];

            if (activeSuggestion) {
              event.preventDefault();
              select(activeSuggestion);
            }
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        placeholder="待つ, まつ, matsu, aspettare"
        role="combobox"
        spellCheck={false}
        type="search"
        value={query}
      />
      <GlossaryAutocompleteDropdown
        activeIndex={resolvedActiveIndex}
        listboxId={listboxId}
        onActiveIndexChange={setActiveIndex}
        onSelect={select}
        shouldShowSuggestions={shouldShowSuggestions}
        suggestions={suggestions}
      />
    </div>
  );
}
