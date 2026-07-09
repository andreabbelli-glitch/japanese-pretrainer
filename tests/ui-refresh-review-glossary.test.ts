import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace() {}
  })
}));

import { GlossaryPortalSearchForm } from "@/components/glossary/glossary-portal-search-form";
import { GlossaryPortalPage } from "@/components/glossary/glossary-portal-page";
import { ReviewPageHeader } from "@/components/review/review-page-client";
import { ReviewForcedContrastAutocomplete } from "@/components/review/review-page-stage";
import {
  getNextGlossaryAutocompleteIndex,
  GlossaryAutocompleteDropdown
} from "@/features/glossary/ui/client/glossary-autocomplete-dropdown";
import type {
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData,
  GlossaryQueryState
} from "@/features/glossary/types";

const defaultFilters: GlossaryQueryState = {
  cards: "all",
  entryType: "all",
  media: "all",
  page: 1,
  query: "",
  segmentId: "all",
  sort: "lesson_order",
  study: "all"
};

const suggestion: GlobalGlossaryAutocompleteSuggestion = {
  aliases: [],
  hasCards: true,
  hasCardlessVariant: false,
  kind: "term",
  label: "食べる",
  localHits: [
    {
      hasCards: true,
      mediaSlug: "sample-media",
      studyKey: "review"
    }
  ],
  meaning: "mangiare",
  mediaCount: 1,
  reading: "たべる",
  resultKey: "term:sample:taberu",
  romaji: "taberu"
};

describe("incremental UI refresh", () => {
  it("makes global and media-filtered Review scope explicit", () => {
    const globalMarkup = renderToStaticMarkup(
      createElement(ReviewPageHeader, {
        isGlobalReview: true,
        mediaTitle: "Sample Media"
      })
    );
    const localMarkup = renderToStaticMarkup(
      createElement(ReviewPageHeader, {
        isGlobalReview: false,
        mediaTitle: "Sample Media"
      })
    );

    expect(globalMarkup).toContain("<h1>Review globale</h1>");
    expect(globalMarkup).not.toContain("Filtro media");
    expect(localMarkup).toContain("<h1>Review · Sample Media</h1>");
    expect(localMarkup).toContain("Filtro media");
    expect(localMarkup).toContain('href="/review"');
  });

  it("wraps autocomplete keyboard navigation in both directions", () => {
    expect(
      getNextGlossaryAutocompleteIndex({
        currentIndex: -1,
        direction: "next",
        suggestionCount: 3
      })
    ).toBe(0);
    expect(
      getNextGlossaryAutocompleteIndex({
        currentIndex: 2,
        direction: "next",
        suggestionCount: 3
      })
    ).toBe(0);
    expect(
      getNextGlossaryAutocompleteIndex({
        currentIndex: 0,
        direction: "previous",
        suggestionCount: 3
      })
    ).toBe(2);
  });

  it("connects the active autocomplete option to the combobox contract", () => {
    const markup = renderToStaticMarkup(
      createElement(GlossaryAutocompleteDropdown, {
        activeIndex: 0,
        listboxId: "glossary-options",
        onSelect() {},
        shouldShowSuggestions: true,
        suggestions: [suggestion]
      })
    );

    expect(markup).toContain('id="glossary-options-option-0"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('lang="ja">食べる</span>');
    expect(markup).toContain('lang="ja">たべる</span> / taberu');
  });

  it("gives the Review contrast autocomplete the same keyboard and ARIA contract", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewForcedContrastAutocomplete, {
        inputRef: { current: null },
        listboxId: "review-contrast-options",
        onClose() {},
        onQueryChange() {},
        onSelect() {},
        query: "taberu",
        shouldShowSuggestions: true,
        suggestions: [suggestion]
      })
    );

    expect(markup).toContain('for="review-forced-contrast-query"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-controls="review-contrast-options"');
    expect(markup).toContain('id="review-contrast-options-option-0"');
  });

  it("keeps advanced Glossary filters closed by default and opens active scope", () => {
    const defaultMarkup = renderToStaticMarkup(
      createElement(GlossaryPortalSearchForm, {
        filters: defaultFilters,
        hasActiveFilters: false,
        mediaOptions: []
      })
    );
    const filteredMarkup = renderToStaticMarkup(
      createElement(GlossaryPortalSearchForm, {
        filters: {
          ...defaultFilters,
          media: "sample-media"
        },
        hasActiveFilters: true,
        mediaOptions: [
          {
            id: "sample-media",
            slug: "sample-media",
            title: "Sample Media"
          }
        ]
      })
    );

    expect(defaultMarkup).toContain(
      '<details class="glossary-search-form__filter-disclosure">'
    );
    expect(defaultMarkup).toContain('for="glossary-portal-query"');
    expect(defaultMarkup).toContain('id="glossary-portal-query"');
    expect(filteredMarkup).toContain(
      '<details class="glossary-search-form__filter-disclosure" open="">'
    );
    expect(filteredMarkup).toContain("1 attivi");
  });

  it("keeps the Glossary H1 in the no-media state", () => {
    const data: GlobalGlossaryPageData = {
      filters: defaultFilters,
      hasActiveFilters: false,
      mediaOptions: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalPages: 1
      },
      results: [],
      resultSummary: {
        filtered: 0,
        total: 0
      },
      stats: {
        crossMediaCount: 0,
        entryCount: 0,
        mediaCount: 0,
        withCardsCount: 0
      }
    };

    const markup = renderToStaticMarkup(
      createElement(GlossaryPortalPage, { data })
    );

    expect(markup).toContain('<h1 class="glossary-hero__title">Glossary</h1>');
    expect(markup).toContain("Nessun media attivo");
  });
});
