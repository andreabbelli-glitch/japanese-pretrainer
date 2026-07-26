import { describe, expect, it } from "vitest";

import { resolveReviewForcedContrastEndpoint } from "@/features/kanji-clash/server/manual-contrast-review";
import { buildReviewSubjectIdentityFromCanonical } from "@/features/review/model/subject";

describe("manual contrast review identity", () => {
  it("keeps contrast endpoints canonical when scheduling uses a task memory key", () => {
    const identity = buildReviewSubjectIdentityFromCanonical({
      canonicalSubjectKey: "group:term:shared-iku",
      cardId: "card-iku-recognition",
      cardType: "recognition",
      crossMediaGroupId: "shared-iku",
      entryId: "term-iku",
      entryType: "term",
      subjectKind: "group"
    });

    expect(identity.subjectKey).toBe(
      "mnemonic:v1:recognition:group:term:shared-iku"
    );
    expect(resolveReviewForcedContrastEndpoint(identity).subjectKey).toBe(
      "group:term:shared-iku"
    );
  });
});
