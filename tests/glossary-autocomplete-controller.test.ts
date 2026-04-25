import { createElement, act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function installMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const doc = new DocumentStub();

  Object.defineProperty(g, "window", {
    configurable: true,
    value: g
  });
  Object.defineProperty(g, "document", {
    configurable: true,
    value: doc
  });
  Object.defineProperty(g, "navigator", {
    configurable: true,
    value: {
      userAgent: "node"
    }
  });
  Object.defineProperty(g, "Element", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "HTMLElement", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "HTMLIFrameElement", {
    configurable: true,
    value: HTMLIFrameElementStub
  });
  Object.defineProperty(g, "Node", {
    configurable: true,
    value: NodeStub
  });
  Object.defineProperty(g, "Text", {
    configurable: true,
    value: TextStub
  });
  Object.defineProperty(g, "Comment", {
    configurable: true,
    value: CommentStub
  });
  Object.defineProperty(g, "SVGElement", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
    writable: true
  });
  Object.defineProperty(g, "history", {
    configurable: true,
    value: {
      replaceState: vi.fn()
    }
  });
  Object.defineProperty(g, "location", {
    configurable: true,
    value: {
      pathname: "/",
      search: ""
    }
  });
  Object.defineProperty(g, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => 1
  });
  Object.defineProperty(g, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => {}
  });

  doc.defaultView = g as typeof globalThis;
  doc.activeElement = doc.body;
}

function uninstallMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  for (const key of [
    "window",
    "document",
    "navigator",
    "Element",
    "HTMLElement",
    "HTMLIFrameElement",
    "Node",
    "Text",
    "Comment",
    "SVGElement",
    "IS_REACT_ACT_ENVIRONMENT",
    "history",
    "location",
    "requestAnimationFrame",
    "cancelAnimationFrame"
  ]) {
    delete g[key];
  }
}

class NodeStub {
  childNodes: NodeStub[] = [];
  parentNode: NodeStub | null = null;

  appendChild<T extends NodeStub>(node: T) {
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore<T extends NodeStub>(node: T, before: NodeStub | null) {
    if (before === null) {
      return this.appendChild(node);
    }

    const index = this.childNodes.indexOf(before);

    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild<T extends NodeStub>(node: T) {
    const index = this.childNodes.indexOf(node);

    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }

    node.parentNode = null;
    return node;
  }

  addEventListener() {}

  removeEventListener() {}
}

class ElementStub extends NodeStub {
  readonly nodeType = 1;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  attributes: Record<string, string> = {};
  nodeName: string;
  ownerDocument: DocumentStub;
  style: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string, ownerDocument: DocumentStub) {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get textContent() {
    return this.childNodes
      .map((child) => ("textContent" in child ? child.textContent : ""))
      .join("");
  }

  set textContent(value: string) {
    this.childNodes =
      value.length > 0 ? [new TextStub(value, this.ownerDocument)] : [];
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  scrollIntoView() {}
}

class TextStub extends NodeStub {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  ownerDocument: DocumentStub;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: DocumentStub) {
    super();
    this.ownerDocument = ownerDocument;
    this.data = text;
    this.nodeValue = text;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class CommentStub extends NodeStub {
  readonly nodeType = 8;
  readonly nodeName = "#comment";
  ownerDocument: DocumentStub;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: DocumentStub) {
    super();
    this.ownerDocument = ownerDocument;
    this.data = text;
    this.nodeValue = text;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class HTMLIFrameElementStub extends ElementStub {}

class DocumentStub extends NodeStub {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  activeElement: ElementStub;
  body: ElementStub;
  defaultView: typeof globalThis | null = null;
  documentElement: ElementStub;

  constructor() {
    super();
    this.body = new ElementStub("body", this);
    this.documentElement = new ElementStub("html", this);
    this.activeElement = this.body;
  }

  createElement(tagName: string) {
    return new ElementStub(tagName, this);
  }

  createElementNS(_namespace: string, tagName: string) {
    return this.createElement(tagName);
  }

  createTextNode(text: string) {
    return new TextStub(text, this);
  }

  createComment(text: string) {
    return new CommentStub(text, this);
  }

  addEventListener() {}

  removeEventListener() {}
}
