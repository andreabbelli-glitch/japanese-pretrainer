import { describe, expect, it } from "vitest";

import {
  deriveEntryStudyState,
  formatDerivedStudyStateLabel
} from "@/lib/study-entry";

describe("study entry labels", () => {
  it("formats each derived study state with stable labels", () => {
    expect(formatDerivedStudyStateLabel("known")).toBe("Già nota");
    expect(formatDerivedStudyStateLabel("learning")).toBe("In studio");
    expect(formatDerivedStudyStateLabel("review")).toBe("In review");
    expect(formatDerivedStudyStateLabel("new")).toBe("Nuova");
    expect(formatDerivedStudyStateLabel("available")).toBe("Disponibile");
  });

  it("keeps derived study states aligned with the shared label formatter", () => {
    const scenarios = [
      {
        expectedKey: "known" as const,
        signals: [{ manualOverride: true, reviewState: null }]
      },
      {
        expectedKey: "learning" as const,
        signals: [{ manualOverride: false, reviewState: "learning" }]
      },
      {
        expectedKey: "review" as const,
        signals: [{ manualOverride: false, reviewState: "review" }]
      },
      {
        expectedKey: "new" as const,
        signals: [{ manualOverride: false, reviewState: "new" }]
      },
      {
        expectedKey: "available" as const,
        signals: []
      }
    ];

    for (const scenario of scenarios) {
      const state = deriveEntryStudyState(scenario.signals);

      expect(state.key).toBe(scenario.expectedKey);
      expect(state.label).toBe(
        formatDerivedStudyStateLabel(scenario.expectedKey)
      );
    }
  });
});
