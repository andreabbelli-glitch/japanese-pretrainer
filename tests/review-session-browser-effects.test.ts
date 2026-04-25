import { act, createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewSessionBrowserEffects } from "@/components/review/use-review-session-browser-effects";

type HookSnapshot = {
  pendingAnsweredCountScroll: number | null;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewSessionBrowserEffects", () => {
  beforeEach(() => {
    installMinimalDom();
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

  it("does not replace history when the current href already matches the session href", async () => {
    setLocation("/review", "?answered=1&card=card-a");

    await renderBrowserEffects({
      answeredCount: 1,
      initialPendingAnsweredCountScroll: null,
      sessionHref: "/review?answered=1&card=card-a"
    });

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("replaces history with the canonical session href when the current href differs", async () => {
    setLocation("/review", "?answered=1&card=card-a");

    await renderBrowserEffects({
      answeredCount: 1,
      initialPendingAnsweredCountScroll: null,
      sessionHref: "/review?answered=1&card=card-a&show=answer"
    });

    expect(window.history.replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/review?answered=1&card=card-a&show=answer"
    );
  });

  it("does not scroll when the pending answered count is empty or not yet passed", async () => {
    const scrollIntoView = vi.fn();
    setReviewStage(scrollIntoView);

    await renderBrowserEffects({
      answeredCount: 2,
      initialPendingAnsweredCountScroll: null,
      sessionHref: "/review?answered=2"
    });

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await cleanupRoot();

    await renderBrowserEffects({
      answeredCount: 2,
      initialPendingAnsweredCountScroll: 2,
      sessionHref: "/review?answered=2"
    });

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls to the review stage after answered count advances and clears the pending count", async () => {
    const scrollIntoView = vi.fn();
    setReviewStage(scrollIntoView);
    const harness = await renderBrowserEffects({
      answeredCount: 2,
      initialPendingAnsweredCountScroll: 1,
      sessionHref: "/review?answered=2"
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(harness.snapshot().pendingAnsweredCountScroll).toBe(1);

    await act(async () => {
      runAnimationFrame(1);
      await Promise.resolve();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(harness.snapshot().pendingAnsweredCountScroll).toBeNull();
  });

  it("cancels a pending scroll frame on cleanup", async () => {
    setReviewStage(vi.fn());

    await renderBrowserEffects({
      answeredCount: 3,
      initialPendingAnsweredCountScroll: 2,
      sessionHref: "/review?answered=3"
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    await cleanupRoot();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});

async function renderBrowserEffects(props: {
  answeredCount: number;
  initialPendingAnsweredCountScroll: number | null;
  sessionHref: "/review" | `/review?${string}`;
}) {
  let latestSnapshot: HookSnapshot | null = null;

  function Probe() {
    const [pendingAnsweredCountScroll, setPendingAnsweredCountScroll] =
      useState<number | null>(props.initialPendingAnsweredCountScroll);

    useReviewSessionBrowserEffects({
      answeredCount: props.answeredCount,
      pendingAnsweredCountScroll,
      sessionHref: props.sessionHref,
      setPendingAnsweredCountScroll
    });

    useEffect(() => {
      latestSnapshot = {
        pendingAnsweredCountScroll
      };
    });

    return null;
  }

  container = document.createElement("div");
  root = createRoot(container);

  await act(async () => {
    root!.render(createElement(Probe));
    await Promise.resolve();
  });

  return {
    snapshot() {
      if (!latestSnapshot) {
        throw new Error("Hook snapshot not mounted.");
      }

      return latestSnapshot;
    }
  };
}

async function cleanupRoot() {
  await act(async () => {
    root?.unmount();
    await Promise.resolve();
  });
  root = null;
  container = null;
}

function setLocation(pathname: string, search: string) {
  Object.assign(window.location, {
    pathname,
    search
  });
}

function setReviewStage(scrollIntoView: (options: { block: string }) => void) {
  (document as unknown as DocumentStub).reviewStage = {
    scrollIntoView
  };
}

function runAnimationFrame(frameId: number) {
  const callback = animationFrameCallbacks.get(frameId);

  if (!callback) {
    throw new Error(`Missing animation frame ${frameId}.`);
  }

  animationFrameCallbacks.delete(frameId);
  callback();
}

const animationFrameCallbacks = new Map<number, () => void>();

function installMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const doc = new DocumentStub();
  let nextAnimationFrameId = 1;

  animationFrameCallbacks.clear();

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
      replaceState: vi.fn(),
      state: {}
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
    value: vi.fn((callback: () => void) => {
      const frameId = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrameCallbacks.set(frameId, callback);
      return frameId;
    })
  });
  Object.defineProperty(g, "cancelAnimationFrame", {
    configurable: true,
    value: vi.fn((frameId: number) => {
      animationFrameCallbacks.delete(frameId);
    })
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
  animationFrameCallbacks.clear();
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
  reviewStage: { scrollIntoView: (options: { block: string }) => void } | null =
    null;

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

  querySelector(selector: string) {
    return selector === ".review-stage" ? this.reviewStage : null;
  }

  addEventListener() {}

  removeEventListener() {}
}
