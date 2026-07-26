import { describe, expect, it } from "vitest";

import {
  buildDefaultFsrsOptimizerSnapshot,
  buildFsrsParameterSet
} from "@/features/fsrs-optimizer/server";

describe("FSRS parameter-set registry", () => {
  it("builds a stable content hash independent of the registry timestamp", () => {
    const snapshot = buildDefaultFsrsOptimizerSnapshot();
    const first = buildFsrsParameterSet(
      snapshot,
      "recognition",
      "2026-01-01T00:00:00.000Z"
    );
    const second = buildFsrsParameterSet(
      snapshot,
      "recognition",
      "2026-07-01T00:00:00.000Z"
    );

    expect(second.parameterHash).toBe(first.parameterHash);
    expect(second.parametersJson).toBe(first.parametersJson);
    expect(second.createdAt).not.toBe(first.createdAt);
    expect(JSON.parse(first.parametersJson)).toMatchObject({
      algorithmVersion: "fsrs6",
      bindingVersion: "ts-fsrs@5.2.3",
      dailyIntervalPolicy:
        "daily-interval:v2:anki-25.07:app-fuzz-shared-rating-seed:load-balance-90:easy-days-normal",
      desiredRetention: 0.9,
      recallTask: "recognition",
      schedulerVersion: "fsrs_v2_study_day",
      studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240"
    });
  });

  it("separates parameter identities by recall task", () => {
    const snapshot = buildDefaultFsrsOptimizerSnapshot();
    const recognition = buildFsrsParameterSet(snapshot, "recognition");
    const concept = buildFsrsParameterSet(snapshot, "concept");
    const other = buildFsrsParameterSet(snapshot, "other");

    expect(
      new Set([
        recognition.parameterHash,
        concept.parameterHash,
        other.parameterHash
      ]).size
    ).toBe(3);
  });
});
