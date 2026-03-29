export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  try {
    const { getDashboardData, getMediaLibraryData } = await import(
      "@/lib/app-shell"
    );
    const { getGlobalReviewFirstCandidateLoadResult } = await import(
      "@/lib/review"
    );

    // Warm the heaviest caches so the first user request is instant.
    await Promise.all([
      getDashboardData(),
      getMediaLibraryData(),
      getGlobalReviewFirstCandidateLoadResult({})
    ]);
  } catch {
    // Warm-up failure is non-fatal — first user request will populate the cache.
  }
}
