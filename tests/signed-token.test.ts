import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createSignedPayloadToken,
  timingSafeStringEqual,
  verifySignedPayloadToken
} from "@/lib/signed-token";

describe("signed token helpers", () => {
  it("round-trips a Japanese UTF-8 payload through the signed token envelope", () => {
    const payload = JSON.stringify({
      lesson: "第1話",
      note: "漢字とかな"
    });
    const secret = "signed-token-test-secret";
    const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
    const expectedSignature = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    const token = createSignedPayloadToken(payload, secret);

    expect(token).toBe(`${encodedPayload}.${expectedSignature}`);
    expect(verifySignedPayloadToken(token, secret)).toBe(payload);
  });

  it("rejects tampered tokens and tokens signed with another secret", () => {
    const token = createSignedPayloadToken("study-token", "correct-secret");

    expect(verifySignedPayloadToken(`${token}tampered`, "correct-secret")).toBe(
      null
    );
    expect(verifySignedPayloadToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects tokens with extra or empty segments", () => {
    const token = createSignedPayloadToken("study-token", "segment-secret");
    const [encodedPayload, signature] = token.split(".");

    expect(verifySignedPayloadToken(`${token}.extra`, "segment-secret")).toBe(
      null
    );
    expect(verifySignedPayloadToken(`.${signature}`, "segment-secret")).toBe(
      null
    );
    expect(verifySignedPayloadToken(`${encodedPayload}.`, "segment-secret")).toBe(
      null
    );
  });

  it("returns false for length-mismatched safe string equality checks", () => {
    expect(timingSafeStringEqual("same", "same")).toBe(true);
    expect(timingSafeStringEqual("same", "different")).toBe(false);
  });
});
