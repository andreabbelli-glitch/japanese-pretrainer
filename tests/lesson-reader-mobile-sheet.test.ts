import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MobileSheet,
  ReaderImageLightbox
} from "@/components/textbook/lesson-reader-ui";
import {
  installMinimalDom,
  type MinimalDomElement,
  type MinimalDomEvent,
  type MinimalDomNode,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

describe("MobileSheet keyboard focus", () => {
  let container: HTMLDivElement | null = null;
  let keydownListener: ((event: KeyboardEvent) => void) | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    document.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (type === "keydown" && typeof listener === "function") {
        keydownListener = listener as (event: KeyboardEvent) => void;
      }
    }) as typeof document.addEventListener;
    document.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (type === "keydown" && listener === keydownListener) {
        keydownListener = null;
      }
    }) as typeof document.removeEventListener;
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("focuses close, traps Tab, closes with Escape, and restores the opener", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    container = document.createElement("div");
    root = createRoot(container);

    function Harness() {
      const [open, setOpen] = useState(true);

      return open
        ? createElement(
            MobileSheet,
            {
              ariaLabel: "Percorso delle lesson",
              onClose: () => setOpen(false),
              returnFocusTo: opener
            },
            createElement("button", { type: "button" }, "Azione interna")
          )
        : null;
    }

    await act(async () => {
      root!.render(createElement(Harness));
    });

    const testRoot = container as unknown as MinimalDomNode;
    const surface = findByClass(testRoot, "reader-sheet__surface");
    const closeButton = findByClass(testRoot, "reader-sheet__close");
    const innerButton = findByText(testRoot, "Azione interna");

    expect(document.activeElement).toBe(closeButton);
    expect(keydownListener).not.toBeNull();
    expect(surface).not.toBeNull();
    expect(innerButton).not.toBeNull();

    Object.assign(surface!, {
      contains(node: MinimalDomNode | null) {
        return node === surface || node === closeButton || node === innerButton;
      },
      querySelectorAll() {
        return [closeButton, innerButton];
      }
    });

    innerButton!.focus();
    const forwardTab = keyboardEvent("Tab");
    keydownListener!(forwardTab as unknown as KeyboardEvent);
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    const backwardTab = keyboardEvent("Tab", true);
    keydownListener!(backwardTab as unknown as KeyboardEvent);
    expect(backwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(innerButton);

    await act(async () => {
      keydownListener!(keyboardEvent("Escape") as unknown as KeyboardEvent);
    });

    expect(container.textContent).toBe("");
    expect(document.activeElement).toBe(opener);
  });

  it("contains lightbox focus and restores the image trigger", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    container = document.createElement("div");
    root = createRoot(container);

    function Harness() {
      const [open, setOpen] = useState(true);

      return open
        ? createElement(ReaderImageLightbox, {
            image: {
              alt: "Carta di esempio",
              captionText: null,
              presentation: {
                height: 908,
                sizes: "24rem",
                variantClassName: "reader-image--card",
                width: 650
              },
              src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            },
            onClose: () => setOpen(false),
            returnFocusTo: opener
          })
        : null;
    }

    await act(async () => {
      root!.render(createElement(Harness));
    });

    const testRoot = container as unknown as MinimalDomNode;
    const surface = findByClass(testRoot, "reader-image-lightbox__surface");
    const closeButton = findByText(testRoot, "Chiudi");

    expect(document.activeElement).toBe(closeButton);
    expect(keydownListener).not.toBeNull();
    expect(surface).not.toBeNull();

    Object.assign(surface!, {
      contains(node: MinimalDomNode | null) {
        return node === surface || node === closeButton;
      },
      querySelectorAll() {
        return [closeButton];
      }
    });

    const forwardTab = keyboardEvent("Tab");
    keydownListener!(forwardTab as unknown as KeyboardEvent);
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    await act(async () => {
      keydownListener!(keyboardEvent("Escape") as unknown as KeyboardEvent);
    });

    expect(container.textContent).toBe("");
    expect(document.activeElement).toBe(opener);
  });
});

function keyboardEvent(key: string, shiftKey = false): MinimalDomEvent {
  const event: MinimalDomEvent = {
    defaultPrevented: false,
    key,
    preventDefault() {
      event.defaultPrevented = true;
    },
    shiftKey,
    type: "keydown"
  };

  return event;
}

function findByClass(
  node: MinimalDomNode | null,
  className: string
): MinimalDomElement | null {
  return findElement(
    node,
    (element) =>
      element.attributes.class?.split(/\s+/u).includes(className) ?? false
  );
}

function findByText(
  node: MinimalDomNode | null,
  text: string
): MinimalDomElement | null {
  return findElement(node, (element) => element.textContent === text);
}

function findElement(
  node: MinimalDomNode | null,
  matches: (element: MinimalDomElement) => boolean
): MinimalDomElement | null {
  if (!node) {
    return null;
  }

  if ("attributes" in node && matches(node as MinimalDomElement)) {
    return node as MinimalDomElement;
  }

  for (const child of node.childNodes) {
    const match = findElement(child, matches);

    if (match) {
      return match;
    }
  }

  return null;
}
