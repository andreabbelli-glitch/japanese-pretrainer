import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function installMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const doc = new DocumentStub();
  const listeners = new Map<string, Set<(event: EventLike) => void>>();

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
  Object.defineProperty(g, "addEventListener", {
    configurable: true,
    value: (type: string, listener: (event: EventLike) => void) => {
      const listenersForType = listeners.get(type) ?? new Set();
      listenersForType.add(listener);
      listeners.set(type, listenersForType);
    }
  });
  Object.defineProperty(g, "removeEventListener", {
    configurable: true,
    value: (type: string, listener: (event: EventLike) => void) => {
      listeners.get(type)?.delete(listener);
    }
  });
  Object.defineProperty(g, "dispatchEvent", {
    configurable: true,
    value: (event: EventLike) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }

      return true;
    }
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
    "addEventListener",
    "removeEventListener",
    "dispatchEvent"
  ]) {
    delete g[key];
  }
}

type EventLike = {
  altKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  key?: string;
  metaKey?: boolean;
  preventDefault: () => void;
  shiftKey?: boolean;
  target?: EventTarget | null;
  type: string;
};

function dispatchWindowKeyboardEvent(key: string) {
  const event: EventLike = {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    key,
    metaKey: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    shiftKey: false,
    target: document.body as unknown as EventTarget,
    type: "keydown"
  };

  window.dispatchEvent(event as unknown as Event);
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
  isContentEditable = false;
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

  blur() {}

  focus() {}
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
}

class HTMLIFrameElementStub extends ElementStub {}

class DocumentStub extends NodeStub {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  activeElement: ElementStub | null = null;
  body: ElementStub;
  defaultView: typeof globalThis | null = null;
  documentElement: ElementStub;

  constructor() {
    super();
    this.documentElement = new ElementStub("html", this);
    this.body = new ElementStub("body", this);
    this.activeElement = this.body;
  }

  createElement(tagName: string) {
    return new ElementStub(tagName, this);
  }

  createElementNS(_namespaceURI: string, tagName: string) {
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
