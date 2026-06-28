import { matchesSecret } from "@/features/security/server/secret-compare";

export const mobileReviewNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0"
};

export function parseBearerToken(authorization: string | null) {
  const prefix = "Bearer ";

  if (!authorization?.startsWith(prefix)) {
    return null;
  }

  const token = authorization.slice(prefix.length).trim();

  return token.length > 0 ? token : null;
}

export function verifyMobileBearerToken(input: {
  authorization: string | null;
  configuredSecret: string | undefined;
}) {
  const configuredSecret = input.configuredSecret?.trim();

  if (!configuredSecret) {
    return "missing-secret" as const;
  }

  return matchesSecret(parseBearerToken(input.authorization), configuredSecret)
    ? ("authorized" as const)
    : ("unauthorized" as const);
}
