import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KanjiClashRoundControllerResult } from "@/components/kanji-clash/use-kanji-clash-round-controller";

const mocks = vi.hoisted(() => ({
  archiveKanjiClashManualContrastAction: vi.fn(),
  refresh: vi.fn(),
  restoreKanjiClashManualContrastAction: vi.fn(),
  submitKanjiClashAnswerAction: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}));

vi.mock("@/actions/kanji-clash", () => ({
  archiveKanjiClashManualContrastAction:
    mocks.archiveKanjiClashManualContrastAction,
  restoreKanjiClashManualContrastAction:
    mocks.restoreKanjiClashManualContrastAction,
  submitKanjiClashAnswerAction: mocks.submitKanjiClashAnswerAction
}));

import { useKanjiClashRoundController } from "@/components/kanji-clash/use-kanji-clash-round-controller";

import {
  buildKanjiClashPageData,
  buildKanjiClashRound
} from "./helpers/kanji-clash-test-data";

describe("useKanjiClashRoundController manual contrast sync", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.archiveKanjiClashManualContrastAction.mockReset();
    mocks.restoreKanjiClashManualContrastAction.mockReset();
    mocks.submitKanjiClashAnswerAction.mockReset();
    mocks.refresh.mockReset();
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

  it("updates manual contrast lists locally after archive and restore without losing the current round", async () => {
    mocks.archiveKanjiClashManualContrastAction.mockResolvedValue(undefined);
    mocks.restoreKanjiClashManualContrastAction.mockResolvedValue(undefined);

    let latestController: KanjiClashRoundControllerResult | null = null;

    function Probe(props: { data: ReturnType<typeof buildKanjiClashPageData> }) {
      const controller = useKanjiClashRoundController(props.data);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    const contrastKey = "entry:term:left::entry:term:right";
    const currentRound = buildKanjiClashRound({
      origin: {
        contrastKey,
        direction: "subject_a",
        type: "manual-contrast"
      },
      pairKey: contrastKey,
      roundKey: `${contrastKey}::subject_a`
    });
    const data = buildKanjiClashPageData({
      currentRound,
      manualContrasts: [
        {
          contrastKey,
          leftLabel: "待つ",
          leftSubjectKey: "entry:term:left",
          rightLabel: "持つ",
          rightSubjectKey: "entry:term:right",
          source: "forced",
          status: "active"
        },
        {
          contrastKey: "entry:term:archived-left::entry:term:archived-right",
          leftLabel: "聞く",
          leftSubjectKey: "entry:term:archived-left",
          rightLabel: "効く",
          rightSubjectKey: "entry:term:archived-right",
          source: "forced",
          status: "archived"
        }
      ]
    });

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { data }));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(controller().activeManualContrasts.map((contrast) => contrast.contrastKey)).toEqual([
      contrastKey
    ]);
    expect(
      controller().archivedManualContrasts.map((contrast) => contrast.contrastKey)
    ).toEqual(["entry:term:archived-left::entry:term:archived-right"]);

    await act(async () => {
      controller().handleArchiveManualContrast(contrastKey);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.archiveKanjiClashManualContrastAction).toHaveBeenCalledWith({
      contrastKey
    });
    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(controller().activeManualContrasts).toHaveLength(0);
    expect(
      controller().archivedManualContrasts.map((contrast) => contrast.contrastKey)
    ).toContain(contrastKey);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      controller().handleRestoreManualContrast(contrastKey);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.restoreKanjiClashManualContrastAction).toHaveBeenCalledWith({
      contrastKey
    });
    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(controller().activeManualContrasts.map((contrast) => contrast.contrastKey)).toEqual([
      contrastKey
    ]);
    expect(
      controller().archivedManualContrasts.map((contrast) => contrast.contrastKey)
    ).not.toContain(contrastKey);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});

function installMinimalDom() {
  class SimpleEvent {
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented = false;
    type: string;

    constructor(type: string, init?: { bubbles?: boolean; cancelable?: boolean }) {
      this.type = type;
      this.bubbles = init?.bubbles ?? false;
      this.cancelable = init?.cancelable ?? false;
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true;
      }
    }
  }

  class SimpleNode {
    childNodes: SimpleNode[] = [];
    isConnected = false;
    nodeType: number;
    ownerDocument: SimpleDocument | null = null;
    parentNode: SimpleNode | null = null;

    constructor(nodeType: number) {
      this.nodeType = nodeType;
    }

    appendChild<T extends SimpleNode>(child: T): T {
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      this.childNodes.push(child);
      child.isConnected = this.isConnected;
      return child;
    }

    insertBefore<T extends SimpleNode>(child: T, before: SimpleNode | null): T {
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      const index = before ? this.childNodes.indexOf(before) : -1;

      if (index === -1) {
        this.childNodes.push(child);
      } else {
        this.childNodes.splice(index, 0, child);
      }

      child.isConnected = this.isConnected;
      return child;
    }

    removeChild<T extends SimpleNode>(child: T): T {
      const index = this.childNodes.indexOf(child);

      if (index >= 0) {
        this.childNodes.splice(index, 1);
      }

      child.parentNode = null;
      child.isConnected = false;
      return child;
    }
  }

  class SimpleTextNode extends SimpleNode {
    data: string;
    nodeValue: string;

    constructor(data: string) {
      super(3);
      this.data = data;
      this.nodeValue = data;
    }
  }

  class SimpleElement extends SimpleNode {
    attributes = new Map<string, string>();
    namespaceURI = "http://www.w3.org/1999/xhtml";
    nodeName: string;
    style = {};
    tagName: string;

    constructor(tagName: string) {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.nodeName = this.tagName;
    }

    addEventListener() {}

    dispatchEvent() {
      return true;
    }

    get firstChild() {
      return this.childNodes[0] ?? null;
    }

    get textContent() {
      return this.childNodes
        .map((child) => {
          if (child instanceof SimpleTextNode) {
            return child.data;
          }

          return child instanceof SimpleElement ? child.textContent : "";
        })
        .join("");
    }

    set textContent(value: string | null) {
      this.childNodes = value ? [new SimpleTextNode(value)] : [];
    }

    removeEventListener() {}

    removeAttribute(name: string) {
      this.attributes.delete(name);
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
  }

  class SimpleDocument extends SimpleNode {
    body: SimpleElement;
    defaultView: typeof globalThis;
    documentElement: SimpleElement;
    nodeName = "#document";

    constructor() {
      super(9);
      this.ownerDocument = this;
      this.isConnected = true;
      this.documentElement = new SimpleElement("html");
      this.documentElement.ownerDocument = this;
      this.documentElement.isConnected = true;
      this.body = new SimpleElement("body");
      this.body.ownerDocument = this;
      this.body.isConnected = true;
      this.documentElement.appendChild(this.body);
      this.appendChild(this.documentElement);
      this.defaultView = globalThis;
    }

    createElement(tagName: string) {
      const element = new SimpleElement(tagName);
      element.ownerDocument = this;
      return element;
    }

    createTextNode(data: string) {
      const node = new SimpleTextNode(data);
      node.ownerDocument = this;
      return node;
    }

    addEventListener() {}

    removeEventListener() {}

    dispatchEvent() {
      return true;
    }
  }

  const document = new SimpleDocument();

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("navigator", { userAgent: "vitest" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("HTMLElement", SimpleElement);
  vi.stubGlobal("HTMLIFrameElement", class {});
  vi.stubGlobal("Node", SimpleNode);
  vi.stubGlobal("Event", SimpleEvent);
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("dispatchEvent", () => true);
}

function uninstallMinimalDom() {
  vi.unstubAllGlobals();
}
