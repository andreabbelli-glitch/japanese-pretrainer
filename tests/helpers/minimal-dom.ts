import { vi } from "vitest";

export type MinimalDomEvent = {
  altKey?: boolean;
  bubbles?: boolean;
  cancelable?: boolean;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  key?: string;
  metaKey?: boolean;
  preventDefault: () => void;
  shiftKey?: boolean;
  target?: EventTarget | null;
  type: string;
};

type MinimalDomInstallOptions = {
  cancelAnimationFrame?: (frameId: number) => void;
  requestAnimationFrame?: (callback: () => void) => number;
};

export function installMinimalDom(options: MinimalDomInstallOptions = {}) {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const doc = new MinimalDomDocument();
  const listeners = new Map<string, Set<(event: MinimalDomEvent) => void>>();

  const addWindowEventListener = (
    type: string,
    listener: (event: MinimalDomEvent) => void
  ) => {
    const listenersForType = listeners.get(type) ?? new Set();
    listenersForType.add(listener);
    listeners.set(type, listenersForType);
  };
  const removeWindowEventListener = (
    type: string,
    listener: (event: MinimalDomEvent) => void
  ) => {
    listeners.get(type)?.delete(listener);
  };
  const dispatchWindowEvent = (event: MinimalDomEvent) => {
    for (const listener of listeners.get(event.type) ?? []) {
      listener(event);
    }

    return true;
  };

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
    value: MinimalDomElement
  });
  Object.defineProperty(g, "HTMLElement", {
    configurable: true,
    value: MinimalDomElement
  });
  Object.defineProperty(g, "HTMLIFrameElement", {
    configurable: true,
    value: MinimalDomIFrameElement
  });
  Object.defineProperty(g, "Node", {
    configurable: true,
    value: MinimalDomNode
  });
  Object.defineProperty(g, "Text", {
    configurable: true,
    value: MinimalDomText
  });
  Object.defineProperty(g, "Comment", {
    configurable: true,
    value: MinimalDomComment
  });
  Object.defineProperty(g, "SVGElement", {
    configurable: true,
    value: MinimalDomElement
  });
  Object.defineProperty(g, "Event", {
    configurable: true,
    value: MinimalDomSyntheticEvent
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
  Object.defineProperty(g, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: options.requestAnimationFrame ?? (() => 1)
  });
  Object.defineProperty(g, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: options.cancelAnimationFrame ?? (() => {})
  });
  Object.defineProperty(g, "addEventListener", {
    configurable: true,
    value: addWindowEventListener
  });
  Object.defineProperty(g, "removeEventListener", {
    configurable: true,
    value: removeWindowEventListener
  });
  Object.defineProperty(g, "dispatchEvent", {
    configurable: true,
    value: dispatchWindowEvent
  });

  doc.defaultView = g as typeof globalThis;
  doc.activeElement = doc.body;
}

export function uninstallMinimalDom() {
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
    "Event",
    "IS_REACT_ACT_ENVIRONMENT",
    "history",
    "location",
    "matchMedia",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "addEventListener",
    "removeEventListener",
    "dispatchEvent"
  ]) {
    delete g[key];
  }
}

export function dispatchWindowKeyboardEvent(key: string) {
  const event: MinimalDomEvent = {
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

export class MinimalDomNode {
  childNodes: MinimalDomNode[] = [];
  isConnected = false;
  ownerDocument: MinimalDomDocument | null = null;
  parentNode: MinimalDomNode | null = null;

  appendChild<T extends MinimalDomNode>(node: T) {
    this.childNodes.push(node);
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument;
    node.isConnected = this.isConnected;
    return node;
  }

  insertBefore<T extends MinimalDomNode>(
    node: T,
    before: MinimalDomNode | null
  ) {
    if (before === null) {
      return this.appendChild(node);
    }

    const index = this.childNodes.indexOf(before);

    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument;
    node.isConnected = this.isConnected;
    return node;
  }

  removeChild<T extends MinimalDomNode>(node: T) {
    const index = this.childNodes.indexOf(node);

    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }

    node.parentNode = null;
    node.isConnected = false;
    return node;
  }

  addEventListener() {}

  removeEventListener() {}
}

export class MinimalDomElement extends MinimalDomNode {
  readonly nodeType = 1;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  attributes: Record<string, string> = {};
  nodeName: string;
  ownerDocument: MinimalDomDocument;
  style: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string, ownerDocument: MinimalDomDocument) {
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

  set textContent(value: string | null) {
    this.childNodes =
      value && value.length > 0
        ? [new MinimalDomText(value, this.ownerDocument)]
        : [];
  }

  blur() {}

  dispatchEvent() {
    return true;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  scrollIntoView() {}

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
}

export class MinimalDomText extends MinimalDomNode {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  ownerDocument: MinimalDomDocument;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: MinimalDomDocument) {
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

export class MinimalDomComment extends MinimalDomNode {
  readonly nodeType = 8;
  readonly nodeName = "#comment";
  ownerDocument: MinimalDomDocument;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: MinimalDomDocument) {
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

export class MinimalDomIFrameElement extends MinimalDomElement {}

export class MinimalDomDocument extends MinimalDomNode {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  activeElement: MinimalDomElement | null = null;
  body: MinimalDomElement;
  defaultView: typeof globalThis | null = null;
  documentElement: MinimalDomElement;
  reviewStage: { scrollIntoView: (options: { block: string }) => void } | null =
    null;

  constructor() {
    super();
    this.ownerDocument = this;
    this.isConnected = true;
    this.documentElement = new MinimalDomElement("html", this);
    this.documentElement.isConnected = true;
    this.body = new MinimalDomElement("body", this);
    this.body.isConnected = true;
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.activeElement = this.body;
  }

  createComment(text: string) {
    return new MinimalDomComment(text, this);
  }

  createElement(tagName: string) {
    return new MinimalDomElement(tagName, this);
  }

  createElementNS(_namespace: string, tagName: string) {
    return new MinimalDomElement(tagName, this);
  }

  createTextNode(text: string) {
    return new MinimalDomText(text, this);
  }

  dispatchEvent() {
    return true;
  }

  querySelector(selector: string) {
    if (selector === ".review-stage" || selector === "[data-review-stage]") {
      return this.reviewStage;
    }

    return null;
  }
}

class MinimalDomSyntheticEvent {
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented = false;
  type: string;

  constructor(
    type: string,
    init?: { bubbles?: boolean; cancelable?: boolean }
  ) {
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
