import { timingSafeEqual } from "node:crypto";

export function matchesSecret(
  providedSecret: string | null | undefined,
  configuredSecret: string
) {
  if (!providedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}
