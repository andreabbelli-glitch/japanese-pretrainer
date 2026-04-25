import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchWindowKeyboardEvent,
  installMinimalDom,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

const mocks = vi.hoisted(() => ({
  useGlossaryAutocomplete: vi.fn()
}));

vi.mock("@/components/glossary/use-glossary-autocomplete", () => ({
  useGlossaryAutocomplete: (input: unknown) =>
    mocks.useGlossaryAutocomplete(input)
}));

import type { ReviewForcedContrastControllerResult } from "@/components/review/use-review-forced-contrast-controller";
import { useReviewForcedContrastController } from "@/components/review/use-review-forced-contrast-controller";

const contrastSuggestion: GlobalGlossaryAutocompleteSuggestion = {
  aliases: [],
  hasCards: true,
  hasCardlessVariant: false,
  kind: "term",
  label: "コスト",
  localHits: [
    {
      hasCards: true,
      mediaSlug: "duel-masters-dm25",
      studyKey: "review"
    }
  ],
  meaning: "costo",
  mediaCount: 1,
  reading: "こすと",
  resultKey: "term:entry:cost",
  romaji: "kosuto"
};

describe("useReviewForcedContrastController", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.useGlossaryAutocomplete.mockImplementation(
      ({ isOpen, query }: { isOpen: boolean; query: string }) => ({
        listboxId: "review-contrast-listbox",
        shouldShowSuggestions: isOpen && query.trim().length > 0,
        suggestions: query.trim().length > 0 ? [contrastSuggestion] : [],
        suggestionsKey: query.trim()
      })
    );
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    vi.restoreAllMocks();
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("opens with C only after answer reveal and closes with Escape", async () => {
    let latestController: ReviewForcedContrastControllerResult | null = null;

    function Probe(props: {
      isAnswerRevealed: boolean;
      selectedCardId: string | null;
    }) {
      const controller = useReviewForcedContrastController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          isAnswerRevealed: false,
          selectedCardId: "card-a"
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      dispatchWindowKeyboardEvent("c");
    });

    expect(controller().isForcedContrastOpen).toBe(false);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          isAnswerRevealed: true,
          selectedCardId: "card-a"
        })
      );
    });

    act(() => {
      dispatchWindowKeyboardEvent("c");
    });

    expect(controller().isForcedContrastOpen).toBe(true);

    act(() => {
      dispatchWindowKeyboardEvent("Escape");
    });

    expect(controller().isForcedContrastOpen).toBe(false);
  });

  it("exposes empty forced contrast state when the selected card changes", async () => {
    let latestController: ReviewForcedContrastControllerResult | null = null;

    function Probe(props: {
      isAnswerRevealed: boolean;
      selectedCardId: string | null;
    }) {
      const controller = useReviewForcedContrastController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          isAnswerRevealed: true,
          selectedCardId: "card-a"
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleOpenForcedContrast();
    });
    act(() => {
      controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      controller().handleForcedContrastSelect(contrastSuggestion);
    });

    expect(controller().forcedContrastQuery).toBe("コスト");
    expect(controller().forcedContrastSelection?.resultKey).toBe(
      "term:entry:cost"
    );

    await act(async () => {
      root!.render(
        createElement(Probe, {
          isAnswerRevealed: true,
          selectedCardId: "card-b"
        })
      );
    });

    expect(controller().forcedContrastQuery).toBe("");
    expect(controller().forcedContrastSelection).toBeNull();
    expect(controller().isForcedContrastOpen).toBe(false);
  });
});
