import { performance } from "node:perf_hooks";

import { cookies, headers } from "next/headers";
import { after } from "next/server";

import {
  APP_PATHNAME_HEADER,
  APP_SEARCH_HEADER,
  readRequestPathname,
  readRequestSearch
} from "@/lib/auth";

export const REVIEW_PROFILE_COOKIE = "jcs_review_profile";
export const REVIEW_PROFILE_COOKIE_MAX_AGE_SECONDS = 60 * 15;
export const REVIEW_PROFILE_HEADER = "x-jcs-review-profile";
export const REVIEW_PROFILE_QUERY_PARAM = "__profile";

type ReviewTimingMeta = Record<string, unknown>;

type ReviewTimingEntry = {
  detail?: ReviewTimingMeta;
  durMs: number;
  error?: string;
  name: string;
};

type ReviewProfilerInput = {
  enabled: boolean;
  label: string;
  meta?: ReviewTimingMeta;
};

export class ReviewProfiler {
  private enabled: boolean;
  private flushed = false;
  private label: string;
  private meta: ReviewTimingMeta;
  private startedAt = performance.now();
  private timings: ReviewTimingEntry[] = [];

  constructor(input: ReviewProfilerInput) {
    this.enabled = input.enabled;
    this.label = input.label;
    this.meta = input.meta ?? {};
  }

  addMeta(meta: ReviewTimingMeta) {
    if (!this.enabled) {
      return;
    }

    Object.assign(this.meta, meta);
  }

  async measure<T>(
    name: string,
    loader: () => Promise<T> | T,
    detail?:
      | ReviewTimingMeta
      | ((value: T) => ReviewTimingMeta | undefined | null)
  ): Promise<T> {
    if (!this.enabled) {
      return loader();
    }

    const startedAt = performance.now();

    try {
      const value = await loader();

      this.timings.push({
        detail:
          typeof detail === "function"
            ? detail(value) ?? undefined
            : detail ?? undefined,
        durMs: roundDuration(performance.now() - startedAt),
        name
      });

      return value;
    } catch (error) {
      this.timings.push({
        durMs: roundDuration(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
        name
      });
      throw error;
    }
  }

  flush(extraMeta?: ReviewTimingMeta) {
    if (!this.enabled || this.flushed) {
      return;
    }

    this.flushed = true;

    console.info(
      "[review-timing]",
      JSON.stringify({
        label: this.label,
        meta: {
          ...this.meta,
          ...extraMeta
        },
        timings: this.timings,
        totalMs: roundDuration(performance.now() - this.startedAt)
      })
    );
  }
}

export async function createRequestReviewProfiler(input: {
  label: string;
  meta?: ReviewTimingMeta;
}) {
  let headerStore: Awaited<ReturnType<typeof headers>> | null = null;
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;

  try {
    [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  } catch {
    // Tests and non-request contexts do not expose the Next request store.
  }

  const enabled = resolveReviewProfilingPreference({
    cookieValue: cookieStore?.get(REVIEW_PROFILE_COOKIE)?.value,
    envValue: process.env.REVIEW_TIMING_LOG,
    headerValue: headerStore?.get(REVIEW_PROFILE_HEADER)
  });

  return new ReviewProfiler({
    enabled,
    label: input.label,
    meta: {
      pathname: readRequestPathname(headerStore?.get(APP_PATHNAME_HEADER) ?? null),
      search: readRequestSearch(headerStore?.get(APP_SEARCH_HEADER) ?? null),
      ...(input.meta ?? {})
    }
  });
}

export function scheduleReviewProfilerFlush(profiler: ReviewProfiler) {
  try {
    after(() => profiler.flush());
  } catch {
    // Tests and non-request contexts do not expose the Next request store.
  }
}

export function resolveReviewProfilingPreference(input: {
  cookieValue?: string | null;
  envValue?: string | null;
  headerValue?: string | null;
}) {
  if (isTruthyFlag(input.envValue)) {
    return true;
  }

  if (isTruthyFlag(input.headerValue)) {
    return true;
  }

  return isTruthyFlag(input.cookieValue);
}

export function resolveReviewProfilingControl(input: {
  cookieValue?: string | null;
  queryValue?: string | null;
}) {
  if (isEnabledFlag(input.queryValue)) {
    return {
      cookieMutation: "enable" as const,
      enabled: true
    };
  }

  if (isDisabledFlag(input.queryValue)) {
    return {
      cookieMutation: "disable" as const,
      enabled: false
    };
  }

  return {
    cookieMutation: "preserve" as const,
    enabled: isTruthyFlag(input.cookieValue)
  };
}

function isDisabledFlag(value: string | null | undefined) {
  return value === "0" || value === "false";
}

function isEnabledFlag(value: string | null | undefined) {
  return value === "1" || value === "true";
}

function isTruthyFlag(value: string | null | undefined) {
  return isEnabledFlag(value);
}

function roundDuration(value: number) {
  return Number(value.toFixed(1));
}

export async function measureWith<T>(
  profiler: ReviewProfiler | null | undefined,
  name: string,
  fn: () => Promise<T> | T,
  detail?:
    | Record<string, unknown>
    | ((value: T) => Record<string, unknown> | undefined | null)
): Promise<T> {
  if (profiler) return profiler.measure(name, fn, detail);
  return fn();
}
