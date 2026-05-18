"use server";

import { invalidateConsolidationMutationCaches } from "@/lib/cache-invalidation-policy";
import {
  markConsolidationKnown,
  submitConsolidationAnswer,
  type MarkConsolidationKnownInput,
  type SubmitConsolidationAnswerInput
} from "@/lib/consolidation";

export async function submitConsolidationAnswerAction(
  input: Omit<SubmitConsolidationAnswerInput, "database" | "now">
) {
  const result = await submitConsolidationAnswer(input);

  invalidateConsolidationMutationCaches({
    mediaId: result.mediaId
  });

  return result;
}

export async function markConsolidationKnownAction(
  input: Omit<MarkConsolidationKnownInput, "database" | "now">
) {
  const result = await markConsolidationKnown(input);

  invalidateConsolidationMutationCaches({
    mediaId: result.mediaId
  });

  return result;
}
