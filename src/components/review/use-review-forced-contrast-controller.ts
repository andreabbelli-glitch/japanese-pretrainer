"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useGlossaryAutocomplete } from "@/components/glossary/use-glossary-autocomplete";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

import {
  toReviewForcedContrastSelection,
  type ReviewForcedContrastSelection
} from "./review-page-state";

type ReviewForcedContrastUiState = {
  cardId: string | null;
  isOpen: boolean;
  query: string;
  selection: ReviewForcedContrastSelection | null;
};

export type ReviewForcedContrastControllerResult = {
  forcedContrastInputRef: RefObject<HTMLInputElement | null>;
  forcedContrastListboxId: string;
  forcedContrastQuery: string;
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  forcedContrastShouldShowSuggestions: boolean;
  forcedContrastSuggestions: GlobalGlossaryAutocompleteSuggestion[];
  handleCloseForcedContrast: () => void;
  handleForcedContrastQueryChange: (value: string) => void;
  handleForcedContrastSelect: (
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) => void;
  handleOpenForcedContrast: () => void;
  handleRemoveForcedContrast: () => void;
  isForcedContrastOpen: boolean;
};

export function useReviewForcedContrastController(input: {
  isAnswerRevealed: boolean;
  selectedCardId: string | null;
}): ReviewForcedContrastControllerResult {
  const { isAnswerRevealed, selectedCardId } = input;
  const forcedContrastInputRef = useRef<HTMLInputElement>(null);
  const [forcedContrastUiState, setForcedContrastUiState] =
    useState<ReviewForcedContrastUiState>({
      cardId: selectedCardId,
      isOpen: false,
      query: "",
      selection: null
    });
  const forcedContrastState =
    forcedContrastUiState.cardId === selectedCardId
      ? forcedContrastUiState
      : {
          cardId: selectedCardId,
          isOpen: false,
          query: "",
          selection: null
        };
  const forcedContrastQuery = forcedContrastState.query;
  const forcedContrastSelection = forcedContrastState.selection;
  const isForcedContrastOpen = forcedContrastState.isOpen;
  const forcedContrastAutocomplete = useGlossaryAutocomplete({
    filters: {
      cards: "with_cards",
      entryType: "all",
      media: "all",
      study: "all"
    },
    isOpen: isForcedContrastOpen,
    query: forcedContrastQuery
  });

  useEffect(() => {
    if (!isForcedContrastOpen) {
      return;
    }

    forcedContrastInputRef.current?.focus?.();
  }, [isForcedContrastOpen]);

  useEffect(() => {
    if (selectedCardId === null || !isAnswerRevealed) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        if (!isForcedContrastOpen) {
          return;
        }

        event.preventDefault();
        setForcedContrastUiState((currentState) => ({
          ...currentState,
          cardId: selectedCardId,
          isOpen: false
        }));
        forcedContrastInputRef.current?.blur?.();
        return;
      }

      if (event.key.toLowerCase() !== "c" || isEditableTarget) {
        return;
      }

      event.preventDefault();
      setForcedContrastUiState((currentState) => ({
        ...currentState,
        cardId: selectedCardId,
        isOpen: !isForcedContrastOpen
      }));
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [isAnswerRevealed, isForcedContrastOpen, selectedCardId]);

  function handleOpenForcedContrast() {
    if (selectedCardId === null || !isAnswerRevealed) {
      return;
    }

    setForcedContrastUiState((currentState) => ({
      ...currentState,
      cardId: selectedCardId,
      isOpen: true
    }));
  }

  function handleCloseForcedContrast() {
    setForcedContrastUiState((currentState) => ({
      ...currentState,
      cardId: selectedCardId,
      isOpen: false
    }));
    forcedContrastInputRef.current?.blur?.();
  }

  function handleForcedContrastQueryChange(value: string) {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: true,
      query: value,
      selection: null
    });
  }

  function handleForcedContrastSelect(
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: false,
      query: suggestion.label,
      selection: toReviewForcedContrastSelection(suggestion)
    });
    forcedContrastInputRef.current?.blur?.();
  }

  function handleRemoveForcedContrast() {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: false,
      query: "",
      selection: null
    });
  }

  return {
    forcedContrastInputRef,
    forcedContrastListboxId: forcedContrastAutocomplete.listboxId,
    forcedContrastQuery,
    forcedContrastSelection,
    forcedContrastShouldShowSuggestions:
      forcedContrastAutocomplete.shouldShowSuggestions,
    forcedContrastSuggestions: forcedContrastAutocomplete.suggestions,
    handleCloseForcedContrast,
    handleForcedContrastQueryChange,
    handleForcedContrastSelect,
    handleOpenForcedContrast,
    handleRemoveForcedContrast,
    isForcedContrastOpen
  };
}
