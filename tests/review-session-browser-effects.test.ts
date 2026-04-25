import { act, createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMinimalDom,
  type MinimalDomDocument,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

import { useReviewSessionBrowserEffects } from "@/components/review/use-review-session-browser-effects";

type HookSnapshot = {
  pendingAnsweredCountScroll: number | null;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewSessionBrowserEffects", () => {
  beforeEach(() => {
    let nextAnimationFrameId = 1;
    animationFrameCallbacks.clear();
    installMinimalDom({
      cancelAnimationFrame: vi.fn((frameId: number) => {
        animationFrameCallbacks.delete(frameId);
      }),
      requestAnimationFrame: vi.fn((callback: () => void) => {
        const frameId = nextAnimationFrameId;
        nextAnimationFrameId += 1;
        animationFrameCallbacks.set(frameId, callback);
        return frameId;
      })
    });
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
  (document as unknown as MinimalDomDocument).reviewStage = {
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
