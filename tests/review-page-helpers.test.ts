import { describe, expect, it } from "vitest";

import { resolveReviewQueuePosition } from "@/components/review/review-page-helpers";
import type { ReviewPageClientData } from "@/components/review/review-page-state";

describe("resolveReviewQueuePosition", () => {
  it("prefers the optimistic queue when the selected card is still present", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        queueCardIds: ["card-a", "card-b", "card-c"]
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });

    expect(resolved.queueCardIds).toEqual(["card-b", "card-c"]);
    expect(resolved.queueIndex).toBe(0);
  });

  it("falls back to the server queue when the optimistic queue no longer has the card", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        queueCardIds: ["card-a", "card-b", "card-c"]
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-a"
    });

    expect(resolved.queueCardIds).toEqual(["card-a", "card-b", "card-c"]);
    expect(resolved.queueIndex).toBe(0);
  });

  it("returns no queue position for first-candidate payloads", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        nextCardId: "card-b"
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });

    expect(resolved.queueCardIds).toEqual(["card-a", "card-b"]);
    expect(resolved.queueIndex).toBe(-1);
  });
});
