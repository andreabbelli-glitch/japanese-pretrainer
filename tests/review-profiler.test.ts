import { describe, expect, it } from "vitest";

import {
  REVIEW_PROFILE_COOKIE,
  REVIEW_PROFILE_HEADER,
  REVIEW_PROFILE_QUERY_PARAM,
  resolveReviewProfilingControl,
  resolveReviewProfilingPreference
} from "@/lib/review-profiler";

describe("review profiler helpers", () => {
  it("exports stable cookie, header and query keys", () => {
    expect(REVIEW_PROFILE_COOKIE).toBe("jcs_review_profile");
    expect(REVIEW_PROFILE_HEADER).toBe("x-jcs-review-profile");
    expect(REVIEW_PROFILE_QUERY_PARAM).toBe("__profile");
  });

  it("enables profiling from env, header or cookie", () => {
    expect(
      resolveReviewProfilingPreference({
        envValue: "1"
      })
    ).toBe(true);
    expect(
      resolveReviewProfilingPreference({
        headerValue: "1"
      })
    ).toBe(true);
    expect(
      resolveReviewProfilingPreference({
        cookieValue: "1"
      })
    ).toBe(true);
    expect(
      resolveReviewProfilingPreference({
        cookieValue: "0"
      })
    ).toBe(false);
  });

  it("lets the query flag enable, disable or preserve the profiling cookie", () => {
    expect(
      resolveReviewProfilingControl({
        cookieValue: "0",
        queryValue: "1"
      })
    ).toEqual({
      cookieMutation: "enable",
      enabled: true
    });
    expect(
      resolveReviewProfilingControl({
        cookieValue: "1",
        queryValue: "0"
      })
    ).toEqual({
      cookieMutation: "disable",
      enabled: false
    });
    expect(
      resolveReviewProfilingControl({
        cookieValue: "1"
      })
    ).toEqual({
      cookieMutation: "preserve",
      enabled: true
    });
  });
});
