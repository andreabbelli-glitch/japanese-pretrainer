"use client";

import type { Route } from "next";
import { useEffect, type Dispatch, type SetStateAction } from "react";

export function useReviewSessionBrowserEffects(input: {
  answeredCount: number;
  pendingAnsweredCountScroll: number | null;
  sessionHref: Route;
  setPendingAnsweredCountScroll: Dispatch<SetStateAction<number | null>>;
}) {
  const {
    answeredCount,
    pendingAnsweredCountScroll,
    sessionHref,
    setPendingAnsweredCountScroll
  } = input;

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (currentHref !== sessionHref) {
      window.history.replaceState(window.history.state, "", sessionHref);
    }
  }, [sessionHref]);

  useEffect(() => {
    if (
      pendingAnsweredCountScroll === null ||
      answeredCount <= pendingAnsweredCountScroll
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".review-stage")
        ?.scrollIntoView({ block: "start" });
      setPendingAnsweredCountScroll(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [answeredCount, pendingAnsweredCountScroll, setPendingAnsweredCountScroll]);
}
