import { createHmac, timingSafeEqual } from "node:crypto";

export function createSignedPayloadToken(payload: string, secret: string) {
  const encodedPayload = encodeBase64Url(payload);
  const signature = signEncodedPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySignedPayloadToken(token: string, secret: string) {
  const tokenSegments = token.split(".");

  if (tokenSegments.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = tokenSegments;

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signEncodedPayload(encodedPayload, secret);

  if (!timingSafeStringEqual(signature, expectedSignature)) {
    return null;
  }

  return Buffer.from(encodedPayload, "base64url").toString("utf8");
}

export function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signEncodedPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
