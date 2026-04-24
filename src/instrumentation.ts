const STARTUP_WARMUP_DELAY_MS = 5000;

export function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

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
