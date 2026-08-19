"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { mediaTextbookLessonTooltipsHref } from "@/features/navigation";
import type {
  TextbookLessonData,
  TextbookTooltipEntry
} from "@/features/textbook/types";

import {
  getTooltipEntryKey,
  hasLessonTooltipTargets,
  type TooltipTarget
} from "./lesson-article";
import {
  computeReaderTooltipPosition,
  READER_TOOLTIP_MAX_WIDTH_PX,
  READER_TOOLTIP_VIEWPORT_MARGIN_PX
} from "./tooltip-position";

type TooltipState = {
  entryKey: string;
  locked: boolean;
  left: number;
  top: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

type MobileSheetState =
  | {
      type: "lessons";
    }
  | {
      type: "entry";
      entryKey: string;
    };

type TooltipLoadState = "idle" | "loading" | "loaded" | "error";

const TOOLTIP_AUDIO_PRELOAD_DELAY_MS = 200;

function buildTooltipEntryMap(entries: TextbookTooltipEntry[]) {
  return new Map(
    entries.map((entry) => [getTooltipEntryKey(entry), entry] as const)
  );
}

type UseLessonReferencesOptions = {
  readerData: TextbookLessonData;
  sourceData: TextbookLessonData;
};

export function useLessonReferences({
  readerData,
  sourceData
}: UseLessonReferencesOptions) {
  const [isTouchLayout, setIsTouchLayout] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetState | null>(null);
  const [entriesByKey, setEntriesByKey] = useState(() =>
    buildTooltipEntryMap(sourceData.entries)
  );
  const [tooltipLoadState, setTooltipLoadState] = useState<TooltipLoadState>(
    sourceData.entries.length > 0 ? "loaded" : "idle"
  );
  const [audioPreloadEntryKey, setAudioPreloadEntryKey] = useState<
    string | null
  >(null);
  const [sourceLessonId, setSourceLessonId] = useState(sourceData.lesson.id);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipRequestRef = useRef<Promise<void> | null>(null);
  const tooltipAbortRef = useRef<AbortController | null>(null);
  const currentLessonIdRef = useRef(sourceData.lesson.id);
  const [mobileSheetOpener, setMobileSheetOpener] =
    useState<HTMLElement | null>(null);

  if (sourceLessonId !== sourceData.lesson.id) {
    setSourceLessonId(sourceData.lesson.id);
    setEntriesByKey(buildTooltipEntryMap(sourceData.entries));
    setTooltipLoadState(sourceData.entries.length > 0 ? "loaded" : "idle");
    setTooltip(null);
    setMobileSheet(null);
    setMobileSheetOpener(null);
  }

  useEffect(() => {
    if (currentLessonIdRef.current === sourceData.lesson.id) {
      return;
    }

    currentLessonIdRef.current = sourceData.lesson.id;
    tooltipAbortRef.current?.abort();
    tooltipAbortRef.current = null;
    tooltipRequestRef.current = null;
    anchorRef.current = null;
  }, [sourceData.lesson.id]);

  useEffect(() => {
    return () => {
      tooltipAbortRef.current?.abort();
    };
  }, []);

  const activeTooltipEntryKey =
    tooltip?.entryKey ??
    (mobileSheet?.type === "entry" ? mobileSheet.entryKey : null);

  useEffect(() => {
    if (!activeTooltipEntryKey) {
      setAudioPreloadEntryKey(null);
      return;
    }

    setAudioPreloadEntryKey((current) =>
      current === activeTooltipEntryKey ? current : null
    );

    const timeoutId = window.setTimeout(() => {
      setAudioPreloadEntryKey(activeTooltipEntryKey);
    }, TOOLTIP_AUDIO_PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTooltipEntryKey]);

  useEffect(() => {
    const updateLayoutMode = () => {
      setIsTouchLayout(
        window.matchMedia(
          "(hover: none), (pointer: coarse), (max-width: 960px)"
        ).matches
      );
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const ensureTooltipEntries = useCallback(async () => {
    if (entriesByKey.size > 0 || tooltipLoadState === "loaded") {
      return;
    }

    if (tooltipRequestRef.current) {
      await tooltipRequestRef.current;
      return;
    }

    const controller = new AbortController();

    tooltipAbortRef.current?.abort();
    tooltipAbortRef.current = controller;
    setTooltipLoadState("loading");

    const request = (async () => {
      try {
        const response = await fetch(
          mediaTextbookLessonTooltipsHref(
            readerData.media.slug,
            readerData.lesson.slug
          ),
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(
            `Tooltip request failed with status ${response.status}.`
          );
        }

        const entries = (await response.json()) as TextbookTooltipEntry[];

        if (controller.signal.aborted) {
          return;
        }

        setEntriesByKey(buildTooltipEntryMap(entries));
        setTooltipLoadState("loaded");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Unable to load textbook tooltip entries.", error);
        setTooltipLoadState("error");
      } finally {
        if (tooltipAbortRef.current === controller) {
          tooltipAbortRef.current = null;
        }

        tooltipRequestRef.current = null;
      }
    })();

    tooltipRequestRef.current = request;
    await request;
  }, [
    entriesByKey,
    readerData.lesson.slug,
    readerData.media.slug,
    tooltipLoadState
  ]);

  useEffect(() => {
    if (
      tooltipLoadState !== "idle" ||
      !hasLessonTooltipTargets(readerData.lesson.ast)
    ) {
      return;
    }

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 150);

    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const id = schedule(() => {
      void ensureTooltipEntries();
    });

    return () => {
      cancel(id);
    };
  }, [readerData.lesson.ast, tooltipLoadState, ensureTooltipEntries]);

  const recomputeTooltipPosition = useCallback(() => {
    if (!anchorRef.current) {
      return;
    }

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const nextPosition = computeReaderTooltipPosition({
      anchorRect,
      tooltipSize: {
        width:
          tooltipRect?.width ??
          Math.min(
            READER_TOOLTIP_MAX_WIDTH_PX,
            Math.max(
              0,
              window.innerWidth - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
            )
          ),
        height: tooltipRect?.height ?? 0
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    setTooltip((current) =>
      current
        ? current.left === nextPosition.left &&
          current.top === nextPosition.top &&
          current.placement === nextPosition.placement &&
          current.maxHeight === nextPosition.maxHeight
          ? current
          : {
              ...current,
              ...nextPosition
            }
        : current
    );
  }, []);

  useEffect(() => {
    if (!tooltip) {
      return;
    }

    const tooltipElement = tooltipRef.current;
    const handleViewportChange = () => {
      recomputeTooltipPosition();
    };

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !tooltipElement
        ? null
        : new ResizeObserver(() => {
            handleViewportChange();
          });
    if (tooltipElement) {
      resizeObserver?.observe(tooltipElement);
    }
    handleViewportChange();

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
      resizeObserver?.disconnect();
    };
  }, [recomputeTooltipPosition, tooltip]);

  useEffect(() => {
    if (!tooltip?.locked) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        tooltipRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }

      setTooltip(null);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [tooltip]);

  const closeTooltipSoon = useCallback(() => {
    if (tooltip?.locked) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setTooltip((current) => (current?.locked ? current : null));
    }, 100);
  }, [clearCloseTimer, tooltip?.locked]);

  const openReference = useCallback(
    (
      target: TooltipTarget,
      element: HTMLElement,
      intent: "hover" | "focus" | "click"
    ) => {
      const entryKey = getTooltipEntryKey(target);

      clearCloseTimer();
      void ensureTooltipEntries();

      if (isTouchLayout) {
        // Restoring focus after closing the sheet must not immediately reopen it.
        // Keyboard activation still emits a click, so focus alone is not the
        // activation gesture on touch layouts.
        if (intent === "focus") {
          return;
        }

        setMobileSheetOpener(element);
        setMobileSheet({
          type: "entry",
          entryKey
        });
        setTooltip(null);
        return;
      }

      anchorRef.current = element;
      const nextPosition = computeReaderTooltipPosition({
        anchorRect: element.getBoundingClientRect(),
        tooltipSize: {
          width: Math.min(
            READER_TOOLTIP_MAX_WIDTH_PX,
            Math.max(
              0,
              window.innerWidth - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
            )
          ),
          height: 0
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });

      setTooltip((current) => {
        if (
          current &&
          current.entryKey === entryKey &&
          current.locked &&
          intent === "click"
        ) {
          return null;
        }

        return {
          entryKey,
          locked: intent === "click",
          ...nextPosition
        };
      });
    },
    [clearCloseTimer, ensureTooltipEntries, isTouchLayout]
  );

  const closeMobileSheet = useCallback(() => {
    setMobileSheet(null);
  }, []);

  const dismissTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const openLessonSheet = useCallback((opener: HTMLButtonElement) => {
    setMobileSheetOpener(opener);
    setMobileSheet({ type: "lessons" });
  }, []);

  const tooltipEntry = tooltip
    ? (entriesByKey.get(tooltip.entryKey) ?? null)
    : null;
  const mobileSheetEntry =
    mobileSheet?.type === "entry"
      ? (entriesByKey.get(mobileSheet.entryKey) ?? null)
      : null;
  const tooltipStyle = tooltip
    ? ({
        left: `${tooltip.left}px`,
        top: `${tooltip.top}px`,
        "--reader-tooltip-max-height": `${tooltip.maxHeight}px`
      } satisfies CSSProperties & Record<"--reader-tooltip-max-height", string>)
    : undefined;

  return {
    audioPreloadEntryKey,
    clearCloseTimer,
    closeMobileSheet,
    closeTooltipSoon,
    dismissTooltip,
    ensureTooltipEntries,
    isTouchLayout,
    mobileSheet,
    mobileSheetEntry,
    mobileSheetOpener,
    openLessonSheet,
    openReference,
    tooltip,
    tooltipEntry,
    tooltipLoadState,
    tooltipRef,
    tooltipStyle
  };
}
