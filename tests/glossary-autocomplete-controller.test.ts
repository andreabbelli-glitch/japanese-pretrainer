import { createElement, act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import { useGlossaryAutocomplete } from "@/components/glossary/use-glossary-autocomplete";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";

const initialSuggestions: GlobalGlossaryAutocompleteSuggestion[] = [
  {
    aliases: [],
    hasCards: true,
    hasCardlessVariant: false,
    kind: "term",
    label: "コスト",
    localHits: [
      {
        hasCards: true,
        mediaSlug: "duel-masters-dm25",
        studyKey: "available"
      }
    ],
    meaning: "costo",
    mediaCount: 1,
    reading: "こすと",
    resultKey: "term:entry:cost",
    romaji: "kosuto"
  }
];

const updatedSuggestions: GlobalGlossaryAutocompleteSuggestion[] = [
  {
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
  }
];

describe("useGlossaryAutocomplete", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    root = null;
    container = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    uninstallMinimalDom();
  });

  it("debounces requests, hides stale results, and reuses cached suggestions for the same normalized key", async () => {
    const firstResponse = new Response(JSON.stringify(initialSuggestions), {
      status: 200
    });
    const secondResponse = new Response(JSON.stringify(updatedSuggestions), {
      status: 200
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(firstResponse);
    fetchMock.mockResolvedValueOnce(secondResponse);

    let latestController: GlossaryAutocompleteProbeResult | null = null;

    function Probe() {
      const [query, setQuery] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const controller = useGlossaryAutocompleteProbe({
        isOpen,
        query
      });

      useEffect(() => {
        latestController = {
          ...controller,
          closeSuggestions: () => {
            setIsOpen(false);
          },
          openSuggestions: () => {
            setIsOpen(true);
          },
          query,
          setQuery: (value: string) => {
            setQuery(value);
          }
        };
      }, [controller, query]);

      return createElement("div");
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().suggestions).toEqual([]);
    expect(controller().shouldShowSuggestions).toBe(false);

    await act(async () => {
      controller().setQuery("kosu");
      controller().openSuggestions();
      await Promise.resolve();
    });

    expect(controller().shouldShowSuggestions).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readFetchedAutocompleteQuery(fetchMock.mock.calls[0]?.[0])).toEqual({
      q: "kosu"
    });
    expect(controller().suggestions).toEqual(initialSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);

    await act(async () => {
      controller().setQuery("kosuto");
      await Promise.resolve();
    });

    expect(controller().shouldShowSuggestions).toBe(false);
    expect(controller().suggestions).toEqual(initialSuggestions);

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(controller().suggestions).toEqual(updatedSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);

    await act(async () => {
      controller().setQuery("  kosu  ");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(controller().suggestions).toEqual(initialSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);
  });

  it("does not fetch while suggestions stay closed", async () => {
    const firstResponse = new Response(JSON.stringify(initialSuggestions), {
      status: 200
    });
    const secondResponse = new Response(JSON.stringify(updatedSuggestions), {
      status: 200
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(firstResponse);
    fetchMock.mockResolvedValueOnce(secondResponse);

    let latestController: GlossaryAutocompleteProbeResult | null = null;

    function Probe() {
      const [query, setQuery] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const controller = useGlossaryAutocompleteProbe({
        isOpen,
        query
      });

      useEffect(() => {
        latestController = {
          ...controller,
          closeSuggestions: () => {
            setIsOpen(false);
          },
          openSuggestions: () => {
            setIsOpen(true);
          },
          query,
          setQuery: (value: string) => {
            setQuery(value);
          }
        };
      }, [controller, query]);

      return createElement("div");
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    await act(async () => {
      controller().setQuery("kosu");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(controller().suggestions).toEqual([]);
    expect(controller().shouldShowSuggestions).toBe(false);

    await act(async () => {
      controller().openSuggestions();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readFetchedAutocompleteQuery(fetchMock.mock.calls[0]?.[0])).toEqual({
      q: "kosu"
    });

    await act(async () => {
      controller().closeSuggestions();
      controller().setQuery("kosuto");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(controller().shouldShowSuggestions).toBe(false);

    await act(async () => {
      controller().openSuggestions();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readFetchedAutocompleteQuery(fetchMock.mock.calls[1]?.[0])).toEqual({
      q: "kosuto"
    });
  });

  it("does not restart the request while only query casing or spacing changes for the same normalized key", async () => {
    const responseDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() => responseDeferred.promise);

    let latestController: GlossaryAutocompleteProbeResult | null = null;

    function Probe() {
      const [query, setQuery] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const controller = useGlossaryAutocompleteProbe({
        isOpen,
        query
      });

      useEffect(() => {
        latestController = {
          ...controller,
          closeSuggestions: () => {
            setIsOpen(false);
          },
          openSuggestions: () => {
            setIsOpen(true);
          },
          query,
          setQuery: (value: string) => {
            setQuery(value);
          }
        };
      }, [controller, query]);

      return createElement("div");
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    await act(async () => {
      controller().setQuery("kosu");
      controller().openSuggestions();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      controller().setQuery("  kosu  ");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      controller().setQuery("KOSU");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    responseDeferred.resolve(
      new Response(JSON.stringify(initialSuggestions), {
        status: 200
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(controller().suggestions).toEqual(initialSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);
  });

  it("ignores an aborted request that finishes JSON parsing after a newer query", async () => {
    const staleJsonDeferred =
      createDeferred<GlobalGlossaryAutocompleteSuggestion[]>();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        json: () => staleJsonDeferred.promise,
        ok: true
      } as Response)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedSuggestions), {
          status: 200
        })
      );

    let latestController: GlossaryAutocompleteProbeResult | null = null;

    function Probe() {
      const [query, setQuery] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const controller = useGlossaryAutocompleteProbe({
        isOpen,
        query
      });

      useEffect(() => {
        latestController = {
          ...controller,
          closeSuggestions: () => {
            setIsOpen(false);
          },
          openSuggestions: () => {
            setIsOpen(true);
          },
          query,
          setQuery: (value: string) => {
            setQuery(value);
          }
        };
      }, [controller, query]);

      return createElement("div");
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    await act(async () => {
      controller().setQuery("kosu");
      controller().openSuggestions();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      controller().setQuery("kosuto");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(140);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(controller().suggestions).toEqual(updatedSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);

    staleJsonDeferred.resolve(initialSuggestions);

    await act(async () => {
      await Promise.resolve();
    });

    expect(controller().suggestions).toEqual(updatedSuggestions);
    expect(controller().shouldShowSuggestions).toBe(true);
  });
});

type GlossaryAutocompleteProbeResult = {
  closeSuggestions: () => void;
  openSuggestions: () => void;
  query: string;
  setQuery: (value: string) => void;
  shouldShowSuggestions: boolean;
  suggestions: GlobalGlossaryAutocompleteSuggestion[];
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

function useGlossaryAutocompleteProbe(input: {
  isOpen: boolean;
  query: string;
}): ReturnType<typeof useGlossaryAutocomplete> {
  return useGlossaryAutocomplete({
    filters: {
      cards: "all",
      entryType: "all",
      media: "all",
      study: "all"
    },
    isOpen: input.isOpen,
    query: input.query
  });
}

function readFetchedAutocompleteQuery(
  request: RequestInfo | URL | string | undefined
) {
  if (!request) {
    throw new Error("missing fetch request");
  }

  const url =
    typeof request === "string"
      ? new URL(request, "https://example.test")
      : request instanceof URL
        ? request
        : new URL(request.url);

  return Object.fromEntries(url.searchParams.entries()) as Record<
    string,
    string
  >;
}
