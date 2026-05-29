export const REVIEW_FORCED_CONTRAST_TARGET_UNAVAILABLE_ERROR =
  "Il contrasto selezionato non è più disponibile.";

export const REVIEW_FORCED_CONTRAST_SAME_SUBJECT_ERROR =
  "Seleziona un contrasto diverso dalla card corrente.";

const SAFE_REVIEW_FORCED_CONTRAST_CLIENT_ERROR_MESSAGES = new Set([
  REVIEW_FORCED_CONTRAST_TARGET_UNAVAILABLE_ERROR,
  REVIEW_FORCED_CONTRAST_SAME_SUBJECT_ERROR
]);

export function getSafeReviewForcedContrastClientErrorMessage(
  error: unknown
): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  return SAFE_REVIEW_FORCED_CONTRAST_CLIENT_ERROR_MESSAGES.has(error.message)
    ? error.message
    : null;
}
