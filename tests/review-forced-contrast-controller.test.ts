import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchWindowKeyboardEvent } from "./helpers/minimal-dom";
import {
  createControllerProbe,
  createReactControllerHarness
} from "./helpers/react-controller-harness";

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
  let harness: ReturnType<typeof createReactControllerHarness>;

  beforeEach(() => {
    harness = createReactControllerHarness();
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
    await harness.cleanup();
    vi.restoreAllMocks();
  });

  it("opens with C only after answer reveal and closes with Escape", async () => {
    const probe = createControllerProbe<
      {
        isAnswerRevealed: boolean;
        selectedCardId: string | null;
      },
      ReviewForcedContrastControllerResult
    >(useReviewForcedContrastController);

    await harness.render(
      probe.element({
        isAnswerRevealed: false,
        selectedCardId: "card-a"
      })
    );

    act(() => {
      dispatchWindowKeyboardEvent("c");
    });

    expect(probe.controller().isForcedContrastOpen).toBe(false);

    await harness.render(
      probe.element({
        isAnswerRevealed: true,
        selectedCardId: "card-a"
      })
    );

    act(() => {
      dispatchWindowKeyboardEvent("c");
    });

    expect(probe.controller().isForcedContrastOpen).toBe(true);

    act(() => {
      dispatchWindowKeyboardEvent("Escape");
    });

    expect(probe.controller().isForcedContrastOpen).toBe(false);
  });

  it("exposes empty forced contrast state when the selected card changes", async () => {
    const probe = createControllerProbe<
      {
        isAnswerRevealed: boolean;
        selectedCardId: string | null;
      },
      ReviewForcedContrastControllerResult
    >(useReviewForcedContrastController);

    await harness.render(
      probe.element({
        isAnswerRevealed: true,
        selectedCardId: "card-a"
      })
    );

    act(() => {
      probe.controller().handleOpenForcedContrast();
    });
    act(() => {
      probe.controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      probe.controller().handleForcedContrastSelect(contrastSuggestion);
    });

    expect(probe.controller().forcedContrastQuery).toBe("コスト");
    expect(probe.controller().forcedContrastSelection?.resultKey).toBe(
      "term:entry:cost"
    );

    await harness.render(
      probe.element({
        isAnswerRevealed: true,
        selectedCardId: "card-b"
      })
    );

    expect(probe.controller().forcedContrastQuery).toBe("");
    expect(probe.controller().forcedContrastSelection).toBeNull();
    expect(probe.controller().isForcedContrastOpen).toBe(false);
  });
});
