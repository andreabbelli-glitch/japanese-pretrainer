const STARTUP_WARMUP_DELAY_MS = 5000;

export function registerNodeInstrumentation() {
  scheduleStartupWarmup();
}

function scheduleStartupWarmup() {
  // Keep the expensive review warm-up out of the first request's critical path.
  const timeout = setTimeout(() => {
    void warmStartupCaches();
  }, STARTUP_WARMUP_DELAY_MS);

  timeout.unref?.();
}

async function warmStartupCaches() {
  try {
    const { getGlobalReviewFirstCandidateLoadResult } = await import(
      "@/lib/review-page-data"
    );

    // Warm the review entry point without forcing the glossary shell snapshots
    // on every cold boot.
    await Promise.all([getGlobalReviewFirstCandidateLoadResult({})]);
  } catch {
    // Warm-up failure is non-fatal; first user request will populate the cache.
  }
}
