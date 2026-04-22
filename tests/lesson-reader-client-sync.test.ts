import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TextbookLessonData } from "@/lib/textbook-types";

const mocks = vi.hoisted(() => ({
  setFuriganaModeAction: vi.fn(),
  setLessonCompletionAction: vi.fn()
}));

vi.mock("@/actions/textbook", () => ({
  setFuriganaModeAction: mocks.setFuriganaModeAction,
  setLessonCompletionAction: mocks.setLessonCompletionAction
}));

vi.mock("@/components/textbook/lesson-article", async () => {
  const React = await import("react");

  return {
    EntryTooltipCard: () => React.createElement("div", null, "tooltip"),
    getTooltipEntryKey: (entry: { id: string; kind: string }) =>
      `${entry.kind}:${entry.id}`,
    hasLessonTooltipTargets: () => false,
    LessonArticle: () => React.createElement("div", null, "article")
  };
});

vi.mock("@/components/textbook/lesson-reader-ui", async () => {
  const React = await import("react");

  return {
    LessonReaderFooter: () => React.createElement("div", null, "footer"),
    LessonReaderHeader: (props: { lesson: { title: string } }) =>
      React.createElement("div", null, props.lesson.title),
    LessonReaderMobileStrip: () =>
      React.createElement("div", null, "mobile-strip"),
    MemoizedLessonRail: () => React.createElement("div", null, "rail"),
    MobileSheet: (props: { children: React.ReactNode }) =>
      React.createElement("div", null, props.children),
    ReaderImageLightbox: () => React.createElement("div", null, "lightbox")
  };
});

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";

describe("LessonReaderClient prop sync", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.setFuriganaModeAction.mockReset();
    mocks.setLessonCompletionAction.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });

    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("syncs refreshed server data for the current lesson", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Summary before refresh"
          })
        })
      );
    });

    expect(readReaderRoot(container)?.attributes["data-furigana-mode"]).toBe(
      "hover"
    );
    expect(container.textContent).toContain("Summary before refresh");

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "off",
            status: "completed",
            statusLabel: "Completata",
            summary: "Summary after refresh"
          })
        })
      );
    });

    expect(readReaderRoot(container)?.attributes["data-furigana-mode"]).toBe(
      "off"
    );
    expect(container.textContent).toContain("Summary after refresh");
    expect(container.textContent).not.toContain("Summary before refresh");
  });
});

function readReaderRoot(container: HTMLDivElement | null) {
  return (container?.firstChild as ElementStub | null) ?? null;
}

function buildLessonData(
  input: Pick<
    TextbookLessonData,
    "furiganaMode"
  > & {
    status: TextbookLessonData["lesson"]["status"];
    statusLabel: string;
    summary: string;
  }
): TextbookLessonData {
  const lesson = {
    completedAt: input.status === "completed" ? "2026-04-10T10:00:00.000Z" : null,
    difficulty: null,
    excerpt: null,
    id: "lesson-001",
    lastOpenedAt: null,
    orderIndex: 1,
    segmentId: "segment-001",
    segmentTitle: "Segment 1",
    slug: "intro",
    status: input.status,
    statusLabel: input.statusLabel,
    summary: input.summary,
    title: "Intro"
  };

  return {
    activeLesson: lesson,
    completedLessons: input.status === "completed" ? 1 : 0,
    entries: [],
    furiganaMode: input.furiganaMode,
    glossaryHref: "/" as never,
    groups: [
      {
        completedLessons: input.status === "completed" ? 1 : 0,
        id: "segment-001",
        lessons: [lesson],
        note: null,
        title: "Segment 1",
        totalLessons: 1
      }
    ],
    lesson: {
      ast: null,
      completedAt: lesson.completedAt,
      difficulty: lesson.difficulty,
      excerpt: lesson.excerpt,
      id: lesson.id,
      segmentTitle: lesson.segmentTitle,
      slug: lesson.slug,
      status: lesson.status,
      statusLabel: lesson.statusLabel,
      summary: lesson.summary,
      title: lesson.title
    },
    lessons: [lesson],
    media: {
      description: "Sample media",
      id: "media-001",
      mediaTypeLabel: "Anime",
      segmentKindLabel: "episodi",
      slug: "sample-media",
      title: "Sample media"
    },
    nextLesson: null,
    previousLesson: null,
    resumeLesson: lesson,
    textbookProgressPercent: input.status === "completed" ? 100 : 0,
    totalLessons: 1
  };
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
  Object.defineProperty(g, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      addEventListener() {},
      addListener() {},
      dispatchEvent() {
        return false;
      },
      matches: false,
      media: "",
      onchange: null,
      removeEventListener() {},
      removeListener() {}
    }))
  });
  Object.defineProperty(g, "addEventListener", {
    configurable: true,
    writable: true,
    value: () => {}
  });
  Object.defineProperty(g, "removeEventListener", {
    configurable: true,
    writable: true,
    value: () => {}
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
    "matchMedia",
    "addEventListener",
    "removeEventListener",
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
