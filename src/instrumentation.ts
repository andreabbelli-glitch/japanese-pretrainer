export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  try {
    const { getGlobalReviewFirstCandidateLoadResult } = await import(
      "@/lib/review"
    );

    // Warm the review entry point without forcing the glossary shell snapshots
    // on every cold boot.
    await Promise.all([
      getGlobalReviewFirstCandidateLoadResult({})
    ]);
  } catch {
    // Warm-up failure is non-fatal — first user request will populate the cache.
  }
}
